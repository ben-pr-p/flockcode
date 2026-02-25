import { Hono } from "hono"
import { upgradeWebSocket, websocket } from "hono/bun"
import { newRpcResponse } from "@hono/capnweb"
import { createClient, Opencode } from "./opencode"
import { Api } from "./rpc"
import { parseArgs } from "util"
import diffPage from "./diff-page/index.html"

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

// API endpoint: returns { file, before, after } for a single file in a session
app.get("/api/diff", async (c) => {
  const sessionId = c.req.query("session")
  const file = c.req.query("file")
  if (!sessionId || !file) {
    return c.json({ error: "Missing session or file query param" }, 400)
  }
  const res = await client.session.diff({ path: { id: sessionId } })
  if (res.error) {
    return c.json({ error: "Failed to fetch diffs" }, 500)
  }
  const match = (res.data ?? []).find((d: any) => d.file === file)
  if (!match) {
    return c.json({ error: `File not found: ${file}` }, 404)
  }
  return c.json({ file: match.file, before: match.before, after: match.after })
})

console.log(`Server starting on port ${port} (opencode: ${opencodeUrl})`)

export default {
  port,
  routes: {
    "/diff": diffPage,
  },
  fetch: app.fetch,
  websocket,
}
