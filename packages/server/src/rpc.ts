// Cap'n Web RPC targets: Api (root) and SessionHandle (per-session).

import { RpcTarget } from "capnweb"
import type { OpencodeClient } from "./opencode"
import {
  mapProject,
  mapSession,
  mapMessage,
  mapChangedFile,
} from "./opencode"
import type {
  Project,
  Session,
  Message,
  ChangedFile,
  PromptPartInput,
} from "./types"

export class SessionHandle extends RpcTarget {
  #client: OpencodeClient
  #sessionId: string

  constructor(client: OpencodeClient, sessionId: string) {
    super()
    this.#client = client
    this.#sessionId = sessionId
  }

  async info(): Promise<Session> {
    const res = await this.#client.session.get({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Session not found: ${this.#sessionId}`)
    return mapSession(res.data)
  }

  async messages(): Promise<Message[]> {
    const res = await this.#client.session.messages({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get messages: ${this.#sessionId}`)
    return (res.data ?? []).map(mapMessage)
  }

  async prompt(parts: PromptPartInput[]): Promise<Message> {
    // TODO: transcribe audio parts via TanStack AI + Gemini 3 Flash
    const textParts = parts.map((p) => {
      if (p.type === "audio") {
        // Placeholder — will be replaced with real transcription
        return { type: "text" as const, text: "[audio transcription pending]" }
      }
      return { type: "text" as const, text: p.text }
    })

    const res = await this.#client.session.prompt({
      path: { id: this.#sessionId },
      body: { parts: textParts },
    })
    if (res.error) throw new Error(`Prompt failed: ${JSON.stringify(res.error)}`)
    return mapMessage(res.data)
  }

  async abort(): Promise<void> {
    const res = await this.#client.session.abort({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Abort failed: ${this.#sessionId}`)
  }

  async changes(): Promise<ChangedFile[]> {
    const res = await this.#client.file.status({
      query: { directory: undefined },
    })
    if (res.error) throw new Error("Failed to get file status")
    return (res.data ?? []).map(mapChangedFile)
  }

  async revert(messageId: string): Promise<Session> {
    const res = await this.#client.session.revert({
      path: { id: this.#sessionId },
      body: { messageID: messageId },
    })
    if (res.error) throw new Error(`Revert failed: ${this.#sessionId}`)
    return mapSession(res.data)
  }

  async share(): Promise<{ url: string }> {
    const res = await this.#client.session.share({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Share failed: ${this.#sessionId}`)
    return { url: res.data?.share?.url ?? "" }
  }
}

export class Api extends RpcTarget {
  #client: OpencodeClient

  constructor(client: OpencodeClient) {
    super()
    this.#client = client
  }

  async listProjects(): Promise<Project[]> {
    const [projectsRes, sessionsRes] = await Promise.all([
      this.#client.project.list(),
      this.#client.session.list(),
    ])
    if (projectsRes.error) throw new Error("Failed to list projects")
    const sessions = sessionsRes.data ?? []
    return (projectsRes.data ?? [])
      .map((p: any) => mapProject(p, sessions))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  async getProject(id: string): Promise<Project> {
    const [projectsRes, sessionsRes] = await Promise.all([
      this.#client.project.list(),
      this.#client.session.list(),
    ])
    const raw = (projectsRes.data ?? []).find((p: any) => p.id === id)
    if (!raw) throw new Error(`Project not found: ${id}`)
    return mapProject(raw, sessionsRes.data ?? [])
  }

  async listSessions(projectId?: string): Promise<Session[]> {
    const res = await this.#client.session.list()
    if (res.error) throw new Error("Failed to list sessions")
    let sessions = (res.data ?? []).map(mapSession)
    if (projectId) {
      sessions = sessions.filter((s) => s.projectId === projectId)
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getSession(id: string): SessionHandle {
    return new SessionHandle(this.#client, id)
  }

  async createSession(opts?: {
    title?: string
  }): Promise<SessionHandle> {
    const res = await this.#client.session.create({
      body: { title: opts?.title },
    })
    if (res.error) throw new Error("Failed to create session")
    return new SessionHandle(this.#client, res.data!.id)
  }

  async deleteSession(id: string): Promise<void> {
    const res = await this.#client.session.delete({
      path: { id },
    })
    if (res.error) throw new Error(`Failed to delete session: ${id}`)
  }
}
