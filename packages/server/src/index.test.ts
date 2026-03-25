import { test, expect, describe } from "bun:test"

// These tests require:
// 1. An opencode server running at localhost:4096
// 2. This server running at localhost:3001

const BASE = "http://localhost:3001"

describe("health", () => {
  test("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`)
    const body = await res.json()
    expect(body.healthy).toBe(true)
    expect(body.opencodeUrl).toBe("http://localhost:4096")
  })
})

describe("instance ID", () => {
  test("GET / returns instanceId", async () => {
    const res = await fetch(`${BASE}/`)
    const body = await res.json()
    expect(typeof body.instanceId).toBe("string")
    expect(body.instanceId.length).toBe(12)
  })
})


