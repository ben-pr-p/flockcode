/**
 * Sprite sync — ensures all local OpenCode projects are cloned on a shared
 * Fly Sprite, and that `.sprite-keep` files are uploaded and current.
 *
 * The sync function is self-contained and can be called from a CLI command
 * or an API endpoint.
 */

import { homedir } from "node:os"
import { relative, join, dirname, basename } from "node:path"
import { createHash } from "node:crypto"
import { ExecError } from "@fly/sprites"
import type { SpriteClient } from "./sprites"
import type { OpencodeClient } from "./opencode"
import type { Project } from "@opencode-ai/sdk"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single cloned project. */
export interface SyncedProject {
  projectId: string
  localPath: string
  spritePath: string
}

/** A file that was uploaded to the Sprite. */
export interface SyncedFile {
  projectId: string
  /** Path relative to the project root. */
  file: string
}

/** A file that was skipped during sync. */
export interface SkippedFile {
  projectId: string
  file: string
  reason: string
}

/** Full result of a sync run. */
export interface SyncResult {
  cloned: SyncedProject[]
  alreadyExists: SyncedProject[]
  filesUploaded: SyncedFile[]
  filesSkipped: SkippedFile[]
  warnings: string[]
}

/** Options for {@link sync}. */
export interface SyncOptions {
  /** If true, report what would happen without making changes. */
  dryRun?: boolean
  /**
   * Callback for progress messages. If not provided, messages are printed to
   * stdout via `console.log`.
   */
  onProgress?: (message: string) => void
}

// ---------------------------------------------------------------------------
// Path mapping
// ---------------------------------------------------------------------------

/**
 * Map a local absolute path to the corresponding Sprite path by stripping
 * the local home directory prefix and re-rooting under the Sprite home.
 *
 * Returns `null` if the path is outside the home directory.
 *
 * ```
 * localPathToSpritePath("/Users/ben/job1/project", "/Users/ben", "/home/sprite")
 * // → "/home/sprite/job1/project"
 * ```
 */
export function localPathToSpritePath(localPath: string, localHome: string, spriteHome: string): string | null {
  const rel = relative(localHome, localPath)
  if (rel.startsWith("..")) {
    return null
  }
  return join(spriteHome, rel)
}

// ---------------------------------------------------------------------------
// .sprite-keep parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `.sprite-keep` file into a list of file path patterns.
 * Blank lines and `#` comments are ignored. Patterns are returned as-is
 * (they may contain globs).
 */
export function parseSpriteKeep(contents: string): string[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------

/**
 * Sync all OpenCode projects to the Sprite.
 *
 * For each project returned by `client.project.list()`:
 * 1. If the repo is not yet cloned on the Sprite, clone it.
 * 2. If a `.sprite-keep` file exists locally, upload any referenced files
 *    that are missing or out of date on the Sprite.
 */
export async function sync(
  sprite: SpriteClient,
  opencode: OpencodeClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { dryRun = false } = options
  const log = options.onProgress ?? console.log

  const result: SyncResult = {
    cloned: [],
    alreadyExists: [],
    filesUploaded: [],
    filesSkipped: [],
    warnings: [],
  }

  // 1. List projects
  const projectsRes = await opencode.project.list()
  const projects = projectsRes.data ?? []
  if (projects.length === 0) {
    log("No projects found.")
    return result
  }

  // 2. Discover home directories
  const localHome = homedir()
  const spriteHome = await sprite.homeDir()
  log(`Local home:  ${localHome}`)
  log(`Sprite home: ${spriteHome}`)
  log(`Syncing ${projects.length} project(s)...\n`)

  // 3. Build a map of remote URL → sprite path for orphan/move detection
  const remoteUrlToSpritePath = new Map<string, string>()

  // 4. Sync each project
  for (const project of projects) {
    const localPath = project.worktree
    const projectId = project.id
    const spritePath = localPathToSpritePath(localPath, localHome, spriteHome)
    const relPath = relative(localHome, localPath)

    if (!spritePath) {
      const warning = `  ⚠ ${localPath} — outside home directory, skipping`
      log(warning)
      result.warnings.push(warning)
      continue
    }

    log(`  ${relPath}`)

    // Get the local git remote URL
    const remoteUrl = await getLocalGitRemoteUrl(localPath)
    if (!remoteUrl) {
      const warning = `    ⚠ could not determine git remote URL, skipping`
      log(warning)
      result.warnings.push(`${relPath} — could not determine git remote URL`)
      continue
    }

    // Check if already cloned on the Sprite
    const existsOnSprite = await sprite.isDirectory(spritePath)

    if (existsOnSprite) {
      // Verify the remote URL matches
      const spriteRemoteUrl = await sprite.tryExecFile(
        "git", ["-C", spritePath, "remote", "get-url", "origin"],
      )

      if (spriteRemoteUrl && normalizeRemoteUrl(spriteRemoteUrl.trim()) !== normalizeRemoteUrl(remoteUrl)) {
        const warning =
          `    ⚠ remote URL mismatch on Sprite ` +
          `(local: ${remoteUrl}, sprite: ${spriteRemoteUrl.trim()}), skipping`
        log(warning)
        result.warnings.push(`${relPath} — remote URL mismatch`)
        continue
      }

      log(`    ✓ already cloned`)
      result.alreadyExists.push({ projectId, localPath, spritePath })
    } else {
      // Clone the repo
      if (dryRun) {
        log(`    → would clone ${remoteUrl}`)
      } else {
        const parentDir = dirname(spritePath)
        await sprite.execFile("mkdir", ["-p", parentDir])

        log(`    cloning ${remoteUrl}...`)
        try {
          await sprite.execFile("git", ["clone", remoteUrl, spritePath])
          log(`    ✓ cloned`)
        } catch (err: unknown) {
          const stderr = err instanceof ExecError
            ? (typeof err.stderr === "string" ? err.stderr : err.stderr.toString("utf-8")).trim()
            : ""
          const detail = stderr || (err instanceof Error ? err.message : String(err))
          const warning = `    ⚠ clone failed: ${detail}`
          log(warning)
          result.warnings.push(`${relPath} — clone failed: ${detail}`)
          continue
        }
      }
      result.cloned.push({ projectId, localPath, spritePath })
    }

    remoteUrlToSpritePath.set(normalizeRemoteUrl(remoteUrl), spritePath)

    // Sync .sprite-keep files
    await syncSpriteKeepFiles(sprite, projectId, localPath, spritePath, dryRun, log, result)
  }

  // 5. Detect orphaned projects on the Sprite
  await detectOrphans(sprite, projects, localHome, spriteHome, remoteUrlToSpritePath, log, result)

  return result
}

// ---------------------------------------------------------------------------
// .sprite-keep file sync
// ---------------------------------------------------------------------------

async function syncSpriteKeepFiles(
  sprite: SpriteClient,
  projectId: string,
  localPath: string,
  spritePath: string,
  dryRun: boolean,
  log: (msg: string) => void,
  result: SyncResult,
): Promise<void> {
  const keepFilePath = join(localPath, ".sprite-keep")
  const keepFile = Bun.file(keepFilePath)
  const keepExists = await keepFile.exists()

  if (!keepExists) {
    log(`    (no .sprite-keep)`)
    return
  }

  const keepContents = await keepFile.text()
  const patterns = parseSpriteKeep(keepContents)

  if (patterns.length === 0) {
    log(`    (empty .sprite-keep)`)
    return
  }

  log(`    syncing .sprite-keep files...`)

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern)
    const matches = glob.scanSync({ cwd: localPath, absolute: false, dot: true })
    let matchCount = 0

    for (const relFile of matches) {
      matchCount++
      const localFilePath = join(localPath, relFile)
      const spriteFilePath = join(spritePath, relFile)

      const localFile = Bun.file(localFilePath)
      const localExists = await localFile.exists()
      if (!localExists) {
        result.filesSkipped.push({ projectId, file: relFile, reason: "not found locally" })
        continue
      }

      const localBytes = new Uint8Array(await localFile.arrayBuffer())
      const localHash = md5(localBytes)

      // Check if the file on the Sprite is already up to date via md5sum.
      // This needs a pipe so we use execBash.
      const spriteHash = await sprite.execBash(
        `md5sum '${spriteFilePath.replace(/'/g, "'\\''")}' 2>/dev/null | awk '{print $1}'`,
      ).then((s) => s.trim()).catch(() => null)

      if (spriteHash && spriteHash === localHash) {
        log(`      ✓ ${relFile} — up to date`)
        result.filesSkipped.push({ projectId, file: relFile, reason: "up to date" })
        continue
      }

      if (dryRun) {
        log(`      → would upload ${relFile}`)
        result.filesUploaded.push({ projectId, file: relFile })
        continue
      }

      // Ensure parent directory exists on Sprite
      const spriteFileDir = dirname(spriteFilePath)
      await sprite.execFile("mkdir", ["-p", spriteFileDir])

      try {
        await sprite.writeFile(spriteFilePath, localBytes)
        log(`      ✓ ${relFile} — uploaded`)
        result.filesUploaded.push({ projectId, file: relFile })
      } catch (err: any) {
        const reason = `upload failed: ${err.message ?? err}`
        log(`      ⚠ ${relFile} — ${reason}`)
        result.filesSkipped.push({ projectId, file: relFile, reason })
      }
    }

    if (matchCount === 0) {
      result.filesSkipped.push({ projectId, file: pattern, reason: "no matches" })
    }
  }
}

// ---------------------------------------------------------------------------
// Orphan detection
// ---------------------------------------------------------------------------

async function detectOrphans(
  sprite: SpriteClient,
  projects: Project[],
  localHome: string,
  spriteHome: string,
  remoteUrlToSpritePath: Map<string, string>,
  log: (msg: string) => void,
  result: SyncResult,
): Promise<void> {
  // Build set of expected Sprite paths
  const expectedPaths = new Set(
    projects
      .map((p) => localPathToSpritePath(p.worktree, localHome, spriteHome))
      .filter((p): p is string => p !== null),
  )

  // Find git repos on the Sprite up to 4 levels deep
  const findResult = await sprite.tryExecFile(
    "find", [spriteHome, "-maxdepth", "4", "-name", ".git", "-type", "d"],
  )

  if (!findResult) return

  const gitDirs = findResult
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((gitDir) => dirname(gitDir))

  for (const dir of gitDirs) {
    if (expectedPaths.has(dir)) continue

    const remoteUrl = await sprite.tryExecFile(
      "git", ["-C", dir, "remote", "get-url", "origin"],
    )
    const normalizedUrl = remoteUrl ? normalizeRemoteUrl(remoteUrl.trim()) : null
    const knownPath = normalizedUrl ? remoteUrlToSpritePath.get(normalizedUrl) : null

    if (knownPath) {
      const warning = `⚠ Orphaned: ${dir} (same repo now at ${knownPath}, safe to remove)`
      log(`\n  ${warning}`)
      result.warnings.push(warning)
    } else {
      const warning = `⚠ Orphaned: ${dir} (exists on Sprite but not in local projects)`
      log(`\n  ${warning}`)
      result.warnings.push(warning)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the `origin` remote URL for a local git repo. */
async function getLocalGitRemoteUrl(repoPath: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "-C", repoPath, "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
    ])
    if (exitCode !== 0) return null
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * Normalize a git remote URL for comparison.
 * Strips trailing `.git`, protocol differences, and trailing slashes.
 */
function normalizeRemoteUrl(url: string): string {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^git@/, "")
    .replace(/^ssh:\/\/git@/, "")
}

/** Compute the MD5 hex digest of a byte array. */
function md5(data: Uint8Array): string {
  return createHash("md5").update(data).digest("hex")
}
