import { Hono } from "hono"
import { upgradeWebSocket, websocket } from "hono/bun"
import { newRpcResponse } from "@hono/capnweb"
import { createClient, Opencode } from "./opencode"
import { Api } from "./rpc"
import { parseArgs } from "util"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "opencode-url": { type: "string", default: "http://localhost:4096" },
    port: { type: "string", default: "3000" },
  },
})

const opencodeUrl = values["opencode-url"]!
const port = parseInt(values.port!, 10)

const client = createClient(opencodeUrl)
const opencode = new Opencode(opencodeUrl)
opencode.spawnListener().catch((err) => {
  console.error("Failed to start opencode event listener:", err)
})
const app = new Hono()

app.all("/rpc", (c) => {
  return newRpcResponse(c, new Api(client, opencode), { upgradeWebSocket })
})

app.get("/health", async (c) => {
  return c.json({ healthy: true, opencodeUrl })
})

console.log(`Server starting on port ${port} (opencode: ${opencodeUrl})`)

export default {
  port,
  fetch: app.fetch,
  websocket,
}
