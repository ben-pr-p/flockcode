import { Hono } from "hono"
import { upgradeWebSocket } from "hono/bun"
import { newRpcResponse } from "@hono/capnweb"
import { DurableStreamServer } from "durable-streams-web-standard"
import { createClient, Opencode } from "./opencode"
import { Api } from "./rpc"

export function createApp(opencodeUrl: string) {
  const client = createClient(opencodeUrl)
  const opencode = new Opencode(opencodeUrl)
  opencode.spawnListener().catch((err) => {
    console.error("Failed to start opencode event listener:", err)
  })
  const app = new Hono()

  // Per-session durable stream servers
  const sessionStreams = new Map<string, DurableStreamServer>()

  function getSessionStreams(sessionId: string): DurableStreamServer {
    let ds = sessionStreams.get(sessionId)
    if (!ds) {
      ds = new DurableStreamServer()
      sessionStreams.set(sessionId, ds)
    }
    return ds
  }

  app.all("/streams/:sessionId/*", (c) => {
    const sessionId = c.req.param("sessionId")
    const ds = getSessionStreams(sessionId)
    // Rewrite the URL so the handler sees the path after /streams/:sessionId
    const url = new URL(c.req.url)
    const prefix = `/streams/${sessionId}`
    url.pathname = url.pathname.slice(prefix.length) || "/"
    const rewritten = new Request(url.toString(), c.req.raw)
    return ds.fetch(rewritten)
  })

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

  // API endpoint: returns all file diffs for a session
  app.get("/api/diffs", async (c) => {
    const sessionId = c.req.query("session")
    if (!sessionId) {
      return c.json({ error: "Missing session query param" }, 400)
    }
    const res = await client.session.diff({ path: { id: sessionId } })
    if (res.error) {
      return c.json({ error: "Failed to fetch diffs" }, 500)
    }
    const diffs = (res.data ?? []).map((d: any) => ({
      file: d.file,
      before: d.before,
      after: d.after,
    }))
    return c.json(diffs)
  })

  return { app, sessionStreams, getSessionStreams }
}
