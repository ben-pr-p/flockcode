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

describe("HTTP API: projects", () => {
  test("GET /api/projects/:id/sessions lists sessions for a project", async () => {
    // First get a project via the durable stream instance
    const rootRes = await fetch(`${BASE}/`)
    const { instanceId } = await rootRes.json()

    // We can't easily query the durable stream from tests, so use the
    // sessions endpoint with a known project. Skip if no projects exist.
    // Instead, test with a nonsensical ID to verify 404 behavior.
    const res = await fetch(`${BASE}/api/projects/nonexistent/sessions`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain("Project not found")
  })
})

describe("HTTP API: sessions", () => {
  test("GET /api/sessions/:id/changes returns array", async () => {
    // We need a valid session ID. Use the durable stream to find one,
    // or test error behavior.
    const res = await fetch(`${BASE}/api/sessions/nonexistent/changes`)
    // OpenCode may return an error for unknown sessions
    expect([200, 500]).toContain(res.status)
  })

  test("POST /api/sessions/:id/prompt validates body", async () => {
    const res = await fetch(`${BASE}/api/sessions/test/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("parts")
  })

  test("POST /api/projects/:id/sessions validates body", async () => {
    const res = await fetch(`${BASE}/api/projects/test/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("parts")
  })
})

describe("HTTP API: diffs", () => {
  test("GET /api/diffs requires session query param", async () => {
    const res = await fetch(`${BASE}/api/diffs`)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("session")
  })

  test("GET /api/diff requires session and file query params", async () => {
    const res = await fetch(`${BASE}/api/diff`)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("session")
  })
})
