#!/usr/bin/env bun
/**
 * CLI entrypoint for the mobilecode tool.
 *
 * Usage:
 *   mobilecode start [--opencode-url <url>] [--port <port>]  — start the HTTP server
 *   mobilecode sync  [--opencode-url <url>] [--dry-run]      — sync projects to Fly Sprite
 */

import { parseArgs } from "util"
import { resolve } from "node:path"
import { createClient } from "./opencode"
import { createSpriteClientFromEnv } from "./sprites"
import { sync } from "./sprite-sync"
import { env } from "./env"

const args = Bun.argv.slice(2)
const subcommand = args.length > 0 && !args[0].startsWith("-") ? args[0] : null

if (subcommand === "start") {
  // -------------------------------------------------------------------------
  // Start subcommand — launch the Bun HTTP server
  //
  // Delegates to server.ts which has the default export Bun needs.
  // Flags after "start" are forwarded as-is.
  // -------------------------------------------------------------------------
  const serverPath = resolve(import.meta.dir, "server.ts")
  const forwarded = args.slice(1)

  const proc = Bun.spawn(["bun", serverPath, ...forwarded], {
    stdio: ["inherit", "inherit", "inherit"],
  })

  // Forward the exit code
  const code = await proc.exited
  process.exit(code)
} else if (subcommand === "sync") {
  // -------------------------------------------------------------------------
  // Sync subcommand — sync projects to Fly Sprite, then exit
  // -------------------------------------------------------------------------
  const { values: syncValues } = parseArgs({
    args: args.slice(1),
    options: {
      "opencode-url": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  })

  const opencodeUrl = syncValues["opencode-url"] ?? env.OPENCODE_URL
  const dryRun = syncValues["dry-run"]!

  const opencode = createClient(opencodeUrl)
  const sprite = createSpriteClientFromEnv()

  if (dryRun) {
    console.log("Dry run — no changes will be made.\n")
  }

  try {
    const result = await sync(sprite, opencode, { dryRun })

    console.log("\n--- Summary ---")
    console.log(`Cloned:     ${result.cloned.length}`)
    console.log(`Existing:   ${result.alreadyExists.length}`)
    console.log(`Uploaded:   ${result.filesUploaded.length}`)
    if (result.filesSkipped.length > 0) {
      console.log(`Skipped:    ${result.filesSkipped.length}`)
    }
    if (result.warnings.length > 0) {
      console.log(`Warnings:   ${result.warnings.length}`)
    }
  } catch (err: any) {
    console.error("Sync failed:", err.message ?? err)
    process.exit(1)
  }

  process.exit(0)
} else {
  // -------------------------------------------------------------------------
  // No subcommand or unknown subcommand — print usage
  // -------------------------------------------------------------------------
  console.log(`mobilecode — mobile AI coding agent server

Usage:
  mobilecode start [options]   Start the HTTP server
  mobilecode sync  [options]   Sync projects to Fly Sprite

start options:
  --opencode-url <url>   OpenCode server URL (default: $OPENCODE_URL or http://localhost:4096)
  --port <port>          Server port (default: $PORT or 3000)

sync options:
  --opencode-url <url>   OpenCode server URL (default: $OPENCODE_URL or http://localhost:4096)
  --dry-run              Show what would happen without making changes`)

  if (subcommand) {
    console.error(`\nUnknown command: ${subcommand}`)
    process.exit(1)
  }
}
