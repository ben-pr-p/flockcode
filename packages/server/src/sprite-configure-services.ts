/**
 * Sprite configure-services — registers an `opencode-serve` service on the
 * Fly Sprite so that `opencode serve` auto-starts on Sprite wake.
 *
 * Intended to be called independently from sync. Run `sync` first to clone
 * repos, then `configure-services` to set up background services.
 */

import type { SpriteClient } from "./sprites"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full result of a spawn-services run. */
export interface SpawnServicesResult {
  /** Whether the opencode-serve service was created fresh. */
  serviceCreated: boolean
  /** Whether an existing opencode-serve service was updated. */
  serviceUpdated: boolean
  /** Whether the service was already configured and left unchanged. */
  serviceUnchanged: boolean
}

/** Options for {@link spawnServices}. */
export interface SpawnServicesOptions {
  /** If true, report what would happen without making changes. */
  dryRun?: boolean
  /**
   * The port opencode should listen on inside the Sprite.
   * @default 4096
   */
  opencodePort?: number
  /**
   * Working directory for the opencode serve process on the Sprite.
   * If not set, no `--dir` flag is passed (opencode uses its default).
   */
  opencodeDir?: string
  /**
   * Callback for progress messages. If not provided, messages are printed to
   * stdout via `console.log`.
   */
  onProgress?: (message: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_NAME = "opencode-serve"

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Ensure the `opencode-serve` service is registered on the Fly Sprite.
 *
 * The service is configured to run `opencode serve --port <port>` and
 * exposes the given HTTP port so the Sprite URL proxies to it.
 */
export async function spawnServices(
  sprite: SpriteClient,
  options: SpawnServicesOptions = {},
): Promise<SpawnServicesResult> {
  const { opencodePort = 4096, opencodeDir, dryRun = false } = options
  const log = options.onProgress ?? console.log

  const result: SpawnServicesResult = {
    serviceCreated: false,
    serviceUpdated: false,
    serviceUnchanged: false,
  }

  const desiredArgs = buildServiceArgs(opencodePort, opencodeDir)

  const existing = await sprite.getService(SERVICE_NAME)

  if (existing) {
    // Check if the existing config matches what we want
    const argsMatch =
      existing.cmd === "opencode" &&
      arraysEqual(existing.args, desiredArgs) &&
      existing.http_port === opencodePort

    if (argsMatch) {
      log(`  ${SERVICE_NAME} — already configured (${existing.state?.status ?? "unknown"})`)
      result.serviceUnchanged = true
    } else {
      if (dryRun) {
        log(`  ${SERVICE_NAME} — would update (cmd/args/port changed)`)
        log(`    current: ${existing.cmd} ${existing.args.join(" ")} (port ${existing.http_port})`)
        log(`    desired: opencode ${desiredArgs.join(" ")} (port ${opencodePort})`)
      } else {
        log(`  ${SERVICE_NAME} — updating (cmd/args/port changed)...`)
        await sprite.putService(SERVICE_NAME, {
          cmd: "opencode",
          args: desiredArgs,
          httpPort: opencodePort,
        })
        log(`  ${SERVICE_NAME} — updated`)
      }
      result.serviceUpdated = true
    }
  } else {
    if (dryRun) {
      log(`  ${SERVICE_NAME} — would create: opencode ${desiredArgs.join(" ")} (port ${opencodePort})`)
    } else {
      log(`  ${SERVICE_NAME} — creating...`)
      await sprite.putService(SERVICE_NAME, {
        cmd: "opencode",
        args: desiredArgs,
        httpPort: opencodePort,
      })
      log(`  ${SERVICE_NAME} — created`)
    }
    result.serviceCreated = true
  }

  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the args array for the opencode serve command. */
function buildServiceArgs(port: number, dir?: string): string[] {
  const args = ["serve", "--port", String(port)]
  if (dir) {
    args.push("--dir", dir)
  }
  return args
}

/** Shallow array equality. */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
