import { test, expect } from "bun:test"
import { stream } from "@durable-streams/client"
import { createApp } from "./app"

test("SSE client receives data written directly to the stream", async () => {
  const { app, getSessionStreams } = createApp("http://localhost:4096")
  const server = Bun.serve({ port: 0, fetch: app.fetch })
  const baseUrl = `http://localhost:${server.port}`

  try {
    const sessionId = "test-session"
    const ds = getSessionStreams(sessionId)

    // Create the stream via the direct API
    await ds.createStream("/events", { contentType: "text/plain" })

    // Start the client subscription from "now" (no existing data yet)
    const res = await stream({
      url: `${baseUrl}/streams/${sessionId}/events`,
      offset: "now",
      live: "sse",
    })

    // Write to the stream directly (in-process)
    await ds.appendToStream("/events", "hello from server", {
      contentType: "text/plain",
    })

    // The client should receive the data via SSE
    const received = await new Promise<string>((resolve) => {
      const unsub = res.subscribeText((chunk) => {
        if (chunk.text.length > 0) {
          unsub()
          resolve(chunk.text)
        }
      })
    })

    expect(received).toBe("hello from server")
  } finally {
    server.stop()
  }
})
