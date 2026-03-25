/**
 * Integration tests for the durable stream endpoints.
 *
 * Verifies that the ephemeral stream (/{instanceId}) and persistent
 * app stream (/app) are wired up and return streamed responses.
 *
 * Uses app.fetch directly — no HTTP server needed.
 *
 * Run: bun test src/streams.test.ts
 */

import { test, expect, describe } from "bun:test"
import { createApp } from "./app"

const BASE = "http://localhost"

describe("stream endpoints", () => {
  test("ephemeral stream at /{instanceId} returns a streaming response", async () => {
    const { app, instanceId } = await createApp("http://localhost:4096")

    const res = await app.fetch(new Request(`${BASE}/${instanceId}`))

    expect(res.status).toBe(200)
    expect(res.body).not.toBeNull()
  })

  test("app stream at /app returns a streaming response", async () => {
    const { app } = await createApp("http://localhost:4096")

    const res = await app.fetch(new Request(`${BASE}/app`))

    expect(res.status).toBe(200)
    expect(res.body).not.toBeNull()
  })
})
