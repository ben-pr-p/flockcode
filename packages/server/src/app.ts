import { Hono } from "hono"
import { DurableStreamServer } from "durable-streams-web-standard"
import { FileBackedStreamStore } from "@durable-streams/server"
import { dataDir } from "@crustjs/store"
import { customAlphabet } from "nanoid"
import { RPCHandler } from "@orpc/server/fetch"
import { onError } from "@orpc/server"
import { createClient, Opencode, handleOpencodeEvent } from "./opencode"
import { env } from "./env"
import { StateStream } from "./state-stream"
import { router } from "./router"
import type { RouterContext } from "./router"
import { logger } from 'hono/logger'

const generateInstanceId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12)

export async function createApp(opencodeUrl: string) {
  const client = createClient(opencodeUrl)
  const opencode = new Opencode(opencodeUrl)

  // Unique instance ID for this server boot — clients use this to detect restarts
  const instanceId = generateInstanceId()

  // Persistent app state stream — survives server restarts
  const appDataDir = dataDir("flockcode")
  const appStore = new FileBackedStreamStore({ dataDir: appDataDir })
  const appDs = new DurableStreamServer({ store: appStore })
  await appDs.createStream("/", { contentType: "application/json" })

  // In-memory index of session→worktree mappings, rebuilt from the persistent
  // app state stream on startup so worktree cleanup survives server restarts.
  const sessionWorktrees = new Map<string, { worktreePath: string; projectWorktree: string }>()
  try {
    const { messages } = appDs.readStream("/")
    const decoder = new TextDecoder()
    for (const msg of messages) {
      const event = JSON.parse(decoder.decode(msg.data))
      if (event.type === "sessionWorktree" && event.value) {
        sessionWorktrees.set(event.key, {
          worktreePath: event.value.worktreePath,
          projectWorktree: event.value.projectWorktree,
        })
      }
    }
  } catch {
    // Stream may be empty on first boot — that's fine
  }

  // Single durable stream server for state protocol events.
  // Created after sessionWorktrees so initialization can emit merge status.
  const ds = new DurableStreamServer()
  const stateStream = new StateStream(ds, client, sessionWorktrees)
  stateStream.initialize().catch((err) => {
    console.error("Failed to initialize state stream:", err)
  })

  // Subscribe to opencode events and route them to the state stream
  opencode.spawnListener((event) => handleOpencodeEvent(event, stateStream), opencodeUrl).catch((err) => {
    console.error("Failed to start opencode event listener:", err)
  })

  const app = new Hono()
  app.use(logger())

  // Optional bearer token auth — required when FLOCK_AUTH_TOKEN is set
  // (e.g., on a publicly accessible Fly Sprite). No-op when running locally.
  const authToken = env.FLOCK_AUTH_TOKEN
  if (authToken) {
    app.use('*', async (c, next) => {
      const header = c.req.header('Authorization')
      if (header !== `Bearer ${authToken}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return next()
    })
  }

  // Returns the current instance ID so clients know where to connect
  app.get("/", (c) => {
    return c.json({ instanceId, appStreamUrl: "/app" })
  })

  // Stream is mounted at /{instanceId} — changes on every restart
  app.all(`/${instanceId}/*`, (c) => {
    const url = new URL(c.req.url)
    url.pathname = url.pathname.slice(`/${instanceId}`.length) || "/"
    const rewritten = new Request(url.toString(), c.req.raw)
    return ds.fetch(rewritten)
  })
  app.all(`/${instanceId}`, (c) => {
    const url = new URL(c.req.url)
    url.pathname = "/"
    const rewritten = new Request(url.toString(), c.req.raw)
    return ds.fetch(rewritten)
  })

  // Persistent app state stream — fixed path, never resets
  app.all("/app/*", (c) => {
    const url = new URL(c.req.url)
    url.pathname = url.pathname.slice("/app".length) || "/"
    return appDs.fetch(new Request(url.toString(), c.req.raw))
  })
  app.all("/app", (c) => {
    const url = new URL(c.req.url)
    url.pathname = "/"
    return appDs.fetch(new Request(url.toString(), c.req.raw))
  })

  app.get("/health", async (c) => {
    return c.json({ healthy: true, opencodeUrl, instanceId })
  })

  // -----------------------------------------------------------------------
  // oRPC handler — serves all typed API procedures at /api/*
  // -----------------------------------------------------------------------

  const routerContext: RouterContext = {
    client,
    appDs,
    sessionWorktrees,
    stateStream,
  }

  const rpcHandler = new RPCHandler(router, {
    interceptors: [
      onError((error) => {
        console.error("[oRPC]", error)
      }),
    ],
  })

  app.use("/api/*", async (c, next) => {
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/api",
      context: routerContext,
    })
    if (matched) {
      return c.newResponse(response.body, response)
    }
    await next()
  })

  return { app, ds, appDs, stateStream, instanceId }
}

export type { Router } from "./router"
