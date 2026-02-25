import { test, expect, beforeAll, afterAll, describe } from "bun:test"
import { newWebSocketRpcSession, newHttpBatchRpcSession } from "capnweb"
import type { Api } from "./rpc"

// These tests require:
// 1. An opencode server running at localhost:4096
// 2. This server started automatically by the test harness

let serverProc: ReturnType<typeof Bun.spawn>

// beforeAll(async () => {
//   serverProc = Bun.spawn(["bun", "src/index.ts", "--port", "3001"], {
//     cwd: import.meta.dir + "/..",
//     stdout: "pipe",
//     stderr: "pipe",
//   })
//   // Wait for server to be ready
//   for (let i = 0; i < 30; i++) {
//     try {
//       const res = await fetch("http://localhost:3001/health")
//       if (res.ok) break
//     } catch {}
//     await Bun.sleep(100)
//   }
// })

// afterAll(() => {
//   serverProc?.kill()
// })

describe("health", () => {
  test("GET /health returns ok", async () => {
    const res = await fetch("http://localhost:3001/health")
    const body = await res.json()
    expect(body.healthy).toBe(true)
    expect(body.opencodeUrl).toBe("http://localhost:4096")
  })
})

describe("HTTP batch RPC", () => {
  test("listProjects returns projects", async () => {
    const api = newHttpBatchRpcSession<Api>("http://localhost:3001/rpc")
    const projects = await api.listProjects()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
    const p = projects[0]
    expect(p).toHaveProperty("id")
    expect(p).toHaveProperty("worktree")
    expect(typeof p.time.created).toBe("number")
  })

  test("listSessions returns sessions", async () => {
    const api = newHttpBatchRpcSession<Api>("http://localhost:3001/rpc")
    const sessions = await api.listSessions()
    expect(Array.isArray(sessions)).toBe(true)
    if (sessions.length > 0) {
      const s = sessions[0]
      expect(s).toHaveProperty("id")
      expect(s).toHaveProperty("projectID")
      expect(s).toHaveProperty("title")
      expect(typeof s.time.created).toBe("number")
      expect(typeof s.time.updated).toBe("number")
    }
  })

  test("listSessions sorted by time.updated desc", async () => {
    const api = newHttpBatchRpcSession<Api>("http://localhost:3001/rpc")
    const sessions = await api.listSessions()
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i - 1].time.updated).toBeGreaterThanOrEqual(
        sessions[i].time.updated
      )
    }
  })

  test("listSessions filters by projectId", async () => {
    // Need separate batch sessions since HTTP batch is single-shot
    const api1 = newHttpBatchRpcSession<Api>("http://localhost:3001/rpc")
    const allSessions = await api1.listSessions()
    if (allSessions.length === 0) return

    const projectId = allSessions[0].projectID
    const api2 = newHttpBatchRpcSession<Api>("http://localhost:3001/rpc")
    const filtered = await api2.listSessions(projectId)
    expect(filtered.every((s) => s.projectID === projectId)).toBe(true)
  })
})

describe("WebSocket RPC", () => {
  test("getSession returns a SessionHandle with info()", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const handle = await api.getSession(sessions[0].id)
    const info = await handle.info()
    expect(info.id).toBe(sessions[0].id)
    expect(info).toHaveProperty("title")
    expect(info).toHaveProperty("projectID")
  })

  test("promise pipelining: getSession().info() in one call", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const info = await api.getSession(sessions[0].id).info()
    expect(info.id).toBe(sessions[0].id)
  })

  test("SessionHandle.messages() returns message array", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const handle = await api.getSession(sessions[0].id)
    const messages = await handle.messages()
    expect(Array.isArray(messages)).toBe(true)
    if (messages.length > 0) {
      const m = messages[0]
      expect(m).toHaveProperty("id")
      expect(m).toHaveProperty("sessionId")
      expect(m).toHaveProperty("role")
      expect(m).toHaveProperty("parts")
      expect(Array.isArray(m.parts)).toBe(true)
      expect(typeof m.createdAt).toBe("number")
    }
  })

  test("messages have correct part types", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const handle = await api.getSession(sessions[0].id)
    const messages = await handle.messages()

    const validPartTypes = ["text", "tool", "step-start", "step-finish", "reasoning"]
    for (const msg of messages) {
      for (const part of msg.parts) {
        expect(validPartTypes).toContain(part.type)
        expect(part).toHaveProperty("id")
      }
    }
  })

  test("SessionHandle.changes() returns changed files array", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const sessions = await api.listSessions()
    if (sessions.length === 0) return

    const handle = await api.getSession(sessions[0].id)
    const changes = await handle.changes()
    expect(Array.isArray(changes)).toBe(true)
    // changes may be empty if no files are modified
  })

  test("getProject returns project with worktree", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    const projects = await api.listProjects()
    if (projects.length === 0) return

    const project = await api.getProject(projects[0].id)
    expect(await project.id).toBe(projects[0].id)
    expect(typeof await project.worktree).toBe("string")
  })

  test("getProject throws for invalid id", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    let threw = false
    try {
      await api.getProject("nonexistent-id")
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  test("getSession().info() throws for invalid session id", async () => {
    using api = newWebSocketRpcSession<Api>("ws://localhost:3001/rpc")
    let threw = false
    try {
      await api.getSession("nonexistent").info()
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })
})
