#!/usr/bin/env bun
/**
 * Bun HTTP server entrypoint. This module is spawned by the CLI `start`
 * subcommand and exports the default Bun server config.
 *
 * CLI flags override environment variables (validated by {@link env}).
 *
 * Usage:
 *   bun src/server.ts [--opencode-url <url>] [--port <port>]
 */

import { parseArgs } from "util"
import { createApp } from "./app"
import { env } from "./env"
import diffPage from "./diff-page/index.html"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "opencode-url": { type: "string" },
    port: { type: "string" },
  },
})

const opencodeUrl = values["opencode-url"] ?? env.OPENCODE_URL
const port = values.port ? parseInt(values.port, 10) : env.PORT

export const { app, ds, appDs, stateStream, instanceId } = await createApp(opencodeUrl)

console.log(`Server starting on port ${port} (opencode: ${opencodeUrl})`)

export default {
  port,
  idleTimeout: 255, // seconds — must exceed durable streams long-poll timeout (30s)
  routes: {
    "/diff": diffPage,
  },
  fetch: app.fetch,
}
