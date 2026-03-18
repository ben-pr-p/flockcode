/**
 * Thin wrapper around the @fly/sprites SDK providing the specific operations
 * needed by sprite-sync: command execution, file existence checks, file
 * read/write, and home directory discovery.
 *
 * File operations use the Sprites REST filesystem API directly since the JS
 * SDK only exposes command execution.
 */

import { SpritesClient, ExecError } from "@fly/sprites"
import type { Sprite, ExecResult } from "@fly/sprites"
import { env } from "./env"

export { ExecError }

/** Options for creating a {@link SpriteClient}. */
export interface SpriteClientOptions {
  /** Sprite name (e.g. "my-dev-sprite"). */
  spriteName: string
  /** Sprites API token. */
  token: string
  /** Base URL for the Sprites API. Defaults to https://api.sprites.dev. */
  baseURL?: string
}

/**
 * Client for interacting with a single Fly Sprite.
 *
 * Wraps the `@fly/sprites` SDK for command execution and uses the Sprites
 * REST filesystem API for file read/write operations.
 */
export class SpriteClient {
  #sprite: Sprite
  #client: SpritesClient
  #spriteName: string
  #baseURL: string
  #token: string
  #cachedHomeDir: string | null = null

  constructor(options: SpriteClientOptions) {
    this.#spriteName = options.spriteName
    this.#token = options.token
    this.#baseURL = options.baseURL ?? "https://api.sprites.dev"
    this.#client = new SpritesClient(options.token, { baseURL: this.#baseURL })
    this.#sprite = this.#client.sprite(options.spriteName)
  }

  /** The underlying Sprite handle from the SDK. */
  get sprite(): Sprite {
    return this.#sprite
  }

  /**
   * Run a command on the Sprite and return stdout as a string.
   *
   * **Note:** The Sprites SDK splits the command string on whitespace and
   * executes directly — no shell is involved. Shell features like `$VAR`,
   * pipes, `&&`/`||` will NOT work. Use {@link execBash} if you need a shell.
   *
   * Throws {@link ExecError} on non-zero exit.
   */
  async exec(command: string, options?: { cwd?: string }): Promise<string> {
    const result: ExecResult = await this.#sprite.exec(command, {
      ...(options?.cwd ? { cwd: options.cwd } : {}),
    })
    return typeof result.stdout === "string" ? result.stdout : result.stdout.toString("utf-8")
  }

  /**
   * Run a command with explicit arguments on the Sprite. Unlike {@link exec},
   * arguments are NOT split on whitespace — each element in `args` is passed
   * as a separate argument. No shell is involved.
   *
   * Returns stdout as a string. Throws {@link ExecError} on non-zero exit.
   */
  async execFile(file: string, args: string[] = [], options?: { cwd?: string }): Promise<string> {
    const result: ExecResult = await this.#sprite.execFile(file, args, {
      ...(options?.cwd ? { cwd: options.cwd } : {}),
    })
    return typeof result.stdout === "string" ? result.stdout : result.stdout.toString("utf-8")
  }

  /**
   * Run a shell command on the Sprite via `bash -c`.
   *
   * Use this when you need shell features (variable expansion, pipes,
   * `&&`/`||`, redirects, etc.). Returns stdout as a string.
   */
  async execBash(command: string, options?: { cwd?: string }): Promise<string> {
    const result = await this.#sprite.execFile("bash", ["-c", command], {
      ...(options?.cwd ? { cwd: options.cwd } : {}),
    })
    return typeof result.stdout === "string" ? result.stdout : result.stdout.toString("utf-8")
  }

  /**
   * Run a command with explicit arguments, returning stdout on success or
   * `null` on non-zero exit (instead of throwing).
   */
  async tryExecFile(file: string, args: string[] = [], options?: { cwd?: string }): Promise<string | null> {
    try {
      return await this.execFile(file, args, options)
    } catch {
      return null
    }
  }

  /**
   * Run a command on the Sprite, returning stdout on success or `null` on
   * non-zero exit (instead of throwing).
   *
   * @deprecated Prefer {@link tryExecFile} — this method splits on whitespace.
   */
  async tryExec(command: string, options?: { cwd?: string }): Promise<string | null> {
    try {
      return await this.exec(command, options)
    } catch {
      return null
    }
  }

  /** Check if a path exists on the Sprite. */
  async exists(remotePath: string): Promise<boolean> {
    try {
      await this.#sprite.execFile("test", ["-e", remotePath])
      return true
    } catch {
      return false
    }
  }

  /** Check if a path is a directory on the Sprite. */
  async isDirectory(remotePath: string): Promise<boolean> {
    try {
      await this.#sprite.execFile("test", ["-d", remotePath])
      return true
    } catch {
      return false
    }
  }

  /**
   * Write a file to the Sprite via the REST filesystem API.
   *
   * Uses `PUT /v1/sprites/{name}/fs/write?path=<path>` with raw bytes body.
   */
  async writeFile(remotePath: string, contents: Buffer | Uint8Array): Promise<void> {
    const url = `${this.#baseURL}/v1/sprites/${encodeURIComponent(this.#spriteName)}/fs/write?path=${encodeURIComponent(remotePath)}`
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(contents) as BodyInit,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Failed to write file ${remotePath}: ${res.status} ${text}`)
    }
  }

  /**
   * Read a file from the Sprite via the REST filesystem API.
   *
   * Uses `GET /v1/sprites/{name}/fs/read?path=<path>`. Returns raw bytes.
   */
  async readFile(remotePath: string): Promise<Buffer> {
    const url = `${this.#baseURL}/v1/sprites/${encodeURIComponent(this.#spriteName)}/fs/read?path=${encodeURIComponent(remotePath)}`
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.#token}`,
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Failed to read file ${remotePath}: ${res.status} ${text}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  /**
   * Get the Sprite's home directory. Cached after the first call.
   */
  async homeDir(): Promise<string> {
    if (this.#cachedHomeDir) return this.#cachedHomeDir
    const result = await this.exec("printenv HOME")
    this.#cachedHomeDir = result.trim()
    return this.#cachedHomeDir
  }
}

/** Escape a string for safe use in a shell command. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/**
 * Create a {@link SpriteClient} from validated environment variables.
 *
 * Uses `SPRITE_NAME`, `SPRITES_TOKEN`, and `SPRITES_API_URL` from {@link env}.
 *
 * @throws if `SPRITE_NAME` or `SPRITES_TOKEN` are empty.
 */
export function createSpriteClientFromEnv(): SpriteClient {
  if (!env.SPRITE_NAME) throw new Error("SPRITE_NAME environment variable is required")
  if (!env.SPRITES_TOKEN) throw new Error("SPRITES_TOKEN environment variable is required")

  return new SpriteClient({
    spriteName: env.SPRITE_NAME,
    token: env.SPRITES_TOKEN,
    baseURL: env.SPRITES_API_URL,
  })
}
