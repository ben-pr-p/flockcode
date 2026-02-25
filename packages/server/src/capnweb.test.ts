// Tests for the RPC target hierarchy using stub chaining.
// Verifies that HTTP batch and WebSocket both support:
//   api.projectList().getState()
//   api.sessionList(worktree).getState()
//   api.getSession(id).messageList().getState()
//   api.getSession(id).changeList().getState()
//   api.getSession(id).getState()
//
// These are the exact call patterns used by the native client hooks.

import { test, expect, beforeAll, afterAll, describe } from "bun:test"
import { newWebSocketRpcSession, newHttpBatchRpcSession } from "capnweb"
import type { Api } from "./rpc"

let serverProc: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  serverProc = Bun.spawn(["bun", "src/index.ts", "--port", "3002"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
  })
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:3002/health")
      if (res.ok) break
    } catch {}
    await Bun.sleep(100)
  }
})

afterAll(() => {
  serverProc?.kill()
})

// ---------- HTTP batch ----------

describe("HTTP batch: stub chaining", () => {
  test("api.projectList().getState() returns projects", async () => {
    const api = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const projects = await api.projectList().getState()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
    expect(projects[0]).toHaveProperty("id")
    expect(projects[0]).toHaveProperty("worktree")
  })

  test("api.sessionList(worktree).getState() returns sessions", async () => {
    const api = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const sessions = await api.sessionList("/").getState()
    expect(Array.isArray(sessions)).toBe(true)
    if (sessions.length > 0) {
      expect(sessions[0]).toHaveProperty("id")
      expect(sessions[0]).toHaveProperty("projectID")
      expect(typeof sessions[0].time.updated).toBe("number")
    }
  })

  test("api.getSession(id).getState() returns session state", async () => {
    const api1 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const sessions = await api1.listSessions()
    if (sessions.length === 0) return

    const api2 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const state = await api2.getSession(sessions[0].id).getState()
    expect(state).toHaveProperty("status")
    expect(state).toHaveProperty("opencode")
  })

  test("api.getSession(id).messageList().getState() returns messages", async () => {
    const api1 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const sessions = await api1.listSessions()
    if (sessions.length === 0) return

    const api2 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const messages = await api2.getSession(sessions[0].id).messageList().getState()
    expect(Array.isArray(messages)).toBe(true)
    if (messages.length > 0) {
      expect(messages[0]).toHaveProperty("id")
      expect(messages[0]).toHaveProperty("role")
      expect(messages[0]).toHaveProperty("parts")
    }
  })

  test("api.getSession(id).changeList().getState() returns changes", async () => {
    const api1 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const sessions = await api1.listSessions()
    if (sessions.length === 0) return

    const api2 = newHttpBatchRpcSession<Api>("http://localhost:3002/rpc")
    const changes = await api2.getSession(sessions[0].id).changeList().getState()
    expect(Array.isArray(changes)).toBe(true)
  })
})

// ---------- WebSocket ----------

describe("WebSocket: stub chaining", () => {
  test("api.projectList().getState() returns projects", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const projects = await api.projectList().getState()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
    expect(projects[0]).toHaveProperty("id")
  })

  test("api.sessionList(worktree).getState() returns sessions", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const sessions = await api.sessionList("/").getState()
    expect(Array.isArray(sessions)).toBe(true)
  })

  test("api.getSession(id).getState() returns session state", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const state = await api.getSession(sessions[0].id).getState()
    expect(state).toHaveProperty("status")
    expect(state).toHaveProperty("opencode")
  })

  test("api.getSession(id).messageList().getState() returns messages", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const messages = await api.getSession(sessions[0].id).messageList().getState()
    expect(Array.isArray(messages)).toBe(true)
    if (messages.length > 0) {
      expect(messages[0]).toHaveProperty("id")
      expect(messages[0]).toHaveProperty("role")
    }
  })

  test("api.getSession(id).changeList().getState() returns changes", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const changes = await api.getSession(sessions[0].id).changeList().getState()
    expect(Array.isArray(changes)).toBe(true)
  })

  test("3-level chain: api.getProject(id).sessionList().getState()", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const projects = await api.listProjects()
    if (projects.length === 0) return

    const sessions = await api.getProject(projects[0].id).sessionList().getState()
    expect(Array.isArray(sessions)).toBe(true)
  })
})

// ---------- Worktree-based session filtering ----------

describe("sessionList(worktree) filtering", () => {
  test("sessionList(directory) filters sessions and returns a strict subset", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")

    const allSessions = await api.sessionList("/").getState()
    expect(allSessions.length).toBeGreaterThan(0)

    // Find a directory that has multiple sessions but not all of them
    const dirCounts = new Map<string, number>()
    for (const s of allSessions) {
      dirCounts.set(s.directory, (dirCounts.get(s.directory) ?? 0) + 1)
    }
    const targetDir = [...dirCounts.entries()].find(
      ([, count]) => count > 1 && count < allSessions.length
    )
    expect(targetDir).toBeDefined()
    const [dir, expectedCount] = targetDir!

    const filtered = await api.sessionList(dir).getState()

    // Must return more than zero but fewer than all
    expect(filtered.length).toBe(expectedCount)
    expect(filtered.length).toBeGreaterThan(1)
    expect(filtered.length).toBeLessThan(allSessions.length)

    // Every returned session's directory must match the filter
    for (const s of filtered) {
      expect(s.directory === dir || s.directory.startsWith(dir + "/")).toBe(true)
    }
  })

  test("sessionList('/') returns all sessions", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3002/rpc")
    const all = await api.sessionList("/").getState()
    expect(all.length).toBeGreaterThan(0)
    // "/" should not filter anything out
    const viaLegacy = await api.listSessions()
    expect(all.length).toBe(viaLegacy.length)
  })
})
