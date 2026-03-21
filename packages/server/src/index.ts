#!/usr/bin/env bun
/**
 * CLI entrypoint for the flockcode tool.
 *
 * Usage:
 *   flock start     [--opencode-url <url>] [--port <port>]         — start the HTTP server
 *   flock sprite sync      [--opencode-url <url>] [--dry-run]      — sync projects to Fly Sprite
 *   flock sprite configure-services [--dry-run]                     — register opencode-serve service on Sprite
 *                          [--opencode-port <port>] [--opencode-dir <dir>]
 */

import { Crust } from "@crustjs/core"
import { helpPlugin, versionPlugin } from "@crustjs/plugins"
import { flag, commandValidator } from "@crustjs/validate/zod"
import { z } from "zod/v4"
import { createClient } from "./opencode"
import { createSpriteClientFromEnv } from "./sprites"
import { sync } from "./sprite-sync"
import { spawnServices } from "./sprite-configure-services"
import { startServer } from "./start-server"
import { env } from "./env"

// ---------------------------------------------------------------------------
// start — launch the Bun HTTP server
// ---------------------------------------------------------------------------

const start = new Crust("start")
  .meta({ description: "Start the HTTP server" })
  .flags({
    "opencode-url": flag(
      z.string().url().optional().describe("OpenCode server URL"),
      { short: "u" },
    ),
    port: flag(
      z.coerce.number().int().positive().optional().describe("Server port"),
      { short: "p" },
    ),
  })
  .run(commandValidator(async ({ flags }) => {
    const opencodeUrl = flags["opencode-url"] ?? env.OPENCODE_URL
    const port = flags.port ?? env.PORT

    await startServer({ opencodeUrl, port })

    // Keep the process alive — Bun.serve runs in the background
    await new Promise(() => {})
  }))

// ---------------------------------------------------------------------------
// sprite sync — sync projects to Fly Sprite
// ---------------------------------------------------------------------------

const spriteSync = new Crust("sync")
  .meta({ description: "Sync projects to Fly Sprite" })
  .flags({
    "opencode-url": flag(
      z.string().url().optional().describe("OpenCode server URL"),
      { short: "u" },
    ),
    "dry-run": flag(
      z.boolean().default(false).describe("Show what would happen without making changes"),
      { short: "n" },
    ),
  })
  .run(commandValidator(async ({ flags }) => {
    const opencodeUrl = flags["opencode-url"] ?? env.OPENCODE_URL
    const dryRun = flags["dry-run"]

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
  }))

// ---------------------------------------------------------------------------
// sprite configure-services — register opencode-serve service on Sprite
// ---------------------------------------------------------------------------

const spriteConfigure = new Crust("configure-services")
  .meta({ description: "Register opencode-serve service on Sprite" })
  .flags({
    "dry-run": flag(
      z.boolean().default(false).describe("Show what would happen without making changes"),
      { short: "n" },
    ),
    "opencode-port": flag(
      z.coerce.number().int().positive().optional().describe("Port for opencode serve on Sprite"),
    ),
    "opencode-dir": flag(
      z.string().optional().describe("Working directory for opencode serve on Sprite"),
    ),
  })
  .run(commandValidator(async ({ flags }) => {
    const dryRun = flags["dry-run"]
    const opencodePort = flags["opencode-port"]
    const opencodeDir = flags["opencode-dir"]

    const sprite = createSpriteClientFromEnv()

    if (dryRun) {
      console.log("Dry run — no changes will be made.\n")
    }

    try {
      const result = await spawnServices(sprite, {
        dryRun,
        opencodePort,
        opencodeDir,
      })

      console.log("\n--- Summary ---")
      if (result.serviceCreated) {
        console.log(`Service:    opencode-serve created`)
      } else if (result.serviceUpdated) {
        console.log(`Service:    opencode-serve updated`)
      } else if (result.serviceUnchanged) {
        console.log(`Service:    opencode-serve unchanged`)
      }
    } catch (err: any) {
      console.error("Configure-services failed:", err.message ?? err)
      process.exit(1)
    }
  }))

// ---------------------------------------------------------------------------
// sprite — container command grouping Sprite operations
// ---------------------------------------------------------------------------

const sprite = new Crust("sprite")
  .meta({ description: "Fly Sprite management commands" })
  .command(spriteSync)
  .command(spriteConfigure)

// ---------------------------------------------------------------------------
// root — flockcode CLI
// ---------------------------------------------------------------------------

const main = new Crust("flock")
  .meta({ description: "Mobile AI coding agent server" })
  .use(versionPlugin("0.0.1"))
  .use(helpPlugin())
  .command(start)
  .command(sprite)

await main.execute()
