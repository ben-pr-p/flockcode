// Cap'n Web RPC targets: Api (root), ProjectList, SessionList, MessageList,
// ChangeList, ProjectHandle, SessionHandle.
//
// Each list/item target exposes getState() and accepts an onStateChanged
// callback so the client receives pushed updates over WebSocket.

import { RpcTarget } from "capnweb"
import type { OpencodeClient, OpencodeSession, OpencodeProject } from "./opencode"
import { Opencode, mapMessage, getSessionId, type SessionEvent } from "./opencode"
import type {
  Project,
  Session,
  File,
  Message,
  PromptPartInput,
} from "./types"

// ---------------------------------------------------------------------------
// Shared callback type for push updates
// ---------------------------------------------------------------------------

type OnStateChangedFn<T> = (newState: T) => void

// ---------------------------------------------------------------------------
// List RPC targets
// ---------------------------------------------------------------------------

export class ProjectList extends RpcTarget {
  #client: OpencodeClient

  constructor(client: OpencodeClient, onStateChanged?: OnStateChangedFn<Project[]>) {
    super()
    this.#client = client
    // TODO: wire opencode events to push project list changes via onStateChanged
  }

  async getState(): Promise<Project[]> {
    const res = await this.#client.project.list()
    if (res.error) throw new Error("Failed to list projects")
    return (res.data as Project[] ?? [])
      .sort((a, b) => ((b.time as any).updated ?? b.time.created) - ((a.time as any).updated ?? a.time.created))
  }
}

export class SessionList extends RpcTarget {
  #client: OpencodeClient
  #worktree: string | undefined

  constructor(client: OpencodeClient, worktree?: string, onStateChanged?: OnStateChangedFn<Session[]>) {
    super()
    this.#client = client
    this.#worktree = worktree
    // TODO: wire opencode events to push session list changes via onStateChanged
  }

  async getState(): Promise<Session[]> {
    const query = this.#worktree && this.#worktree !== '/'
      ? { directory: this.#worktree }
      : undefined
    const res = await this.#client.session.list({ query })
    if (res.error) throw new Error("Failed to list sessions")
    const sessions = (res.data ?? []) as Session[]
    return sessions.sort((a, b) => b.time.updated - a.time.updated)
  }
}

export class MessageList extends RpcTarget {
  #client: OpencodeClient
  #sessionId: string
  #opencode: Opencode | undefined
  #onStateChanged: OnStateChangedFn<Message[]> | undefined

  constructor(
    client: OpencodeClient,
    sessionId: string,
    opencode?: Opencode,
    onStateChanged?: OnStateChangedFn<Message[]>,
  ) {
    super()
    this.#client = client
    this.#sessionId = sessionId
    this.#opencode = opencode
    this.#onStateChanged = onStateChanged

    if (opencode && onStateChanged) {
      opencode.addSessionListener(sessionId, async () => {
        try {
          const state = await this.getState()
          onStateChanged(state)
        } catch {}
      })
    }
  }

  async getState(): Promise<Message[]> {
    const res = await this.#client.session.messages({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get messages: ${this.#sessionId}`)
    return (res.data ?? []).map(mapMessage)
  }
}

export class ChangeList extends RpcTarget {
  #client: OpencodeClient
  #sessionId: string

  constructor(
    client: OpencodeClient,
    sessionId: string,
    onStateChanged?: OnStateChangedFn<File[]>,
  ) {
    super()
    this.#client = client
    this.#sessionId = sessionId
    // TODO: wire opencode events for file change pushes
  }

  async getState(): Promise<File[]> {
    const res = await this.#client.session.diff({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get changes: ${this.#sessionId}`)
    return (res.data ?? []).map((d: any) => ({
      path: d.file,
      added: d.additions,
      removed: d.deletions,
      status: d.status === "deleted" ? "deleted"
        : d.status === "added" ? "added"
        : "modified" as "added" | "deleted" | "modified",
    }))
  }
}

// ---------------------------------------------------------------------------
// Api (root target)
// ---------------------------------------------------------------------------

export class Api extends RpcTarget {
  #client: OpencodeClient
  #opencode: Opencode | undefined

  constructor(client: OpencodeClient, opencode?: Opencode) {
    super()
    this.#client = client
    this.#opencode = opencode
  }

  // Legacy — kept for backward compat with existing tests
  async listProjects(): Promise<Project[]> {
    const res = await this.#client.project.list()
    if (res.error) throw new Error("Failed to list projects")
    return (res.data as Project[] ?? [])
      .sort((a, b) => ((b.time as any).updated ?? b.time.created) - ((a.time as any).updated ?? a.time.created))
  }

  // Returns a reactive ProjectList RPC target
  projectList(onStateChanged?: OnStateChangedFn<Project[]>): ProjectList {
    return new ProjectList(this.#client, onStateChanged)
  }

  async getProject(id: string): Promise<ProjectHandle> {
    const res = await this.#client.project.list()
    const project = (res.data as Project[] ?? []).find((p) => p.id === id)
    if (!project) throw new Error(`Project not found: ${id}`)
    return new ProjectHandle(this.#client, project, this.#opencode)
  }

  // Legacy — kept for backward compat with existing tests
  async listSessions(projectId?: string): Promise<Session[]> {
    const res = await this.#client.session.list()
    if (res.error) throw new Error("Failed to list sessions")
    let sessions = (res.data ?? []) as Session[]
    if (projectId) {
      const projectsRes = await this.#client.project.list()
      const project = (projectsRes.data ?? []).find((p: any) => p.id === projectId)
      if (project) {
        const worktree = project.worktree
        sessions = sessions.filter((s) =>
          s.directory === worktree || s.directory.startsWith(worktree + "/")
        )
      }
    }
    return sessions.sort((a, b) => b.time.updated - a.time.updated)
  }

  // Returns a reactive SessionList RPC target filtered by worktree
  sessionList(worktree: string, onStateChanged?: OnStateChangedFn<Session[]>): SessionList {
    return new SessionList(this.#client, worktree, onStateChanged)
  }

  getSession(id: string, onSessionStateChanged?: OnStateChangedFn<SessionState>): SessionHandle {
    return new SessionHandle(this.#client, id, this.#opencode, onSessionStateChanged)
  }

  async createSession(opts: {
    title?: string,
    onSessionStateChanged?: OnStateChangedFn<SessionState>,
  }): Promise<SessionHandle> {
    const res = await this.#client.session.create({
      body: { title: opts?.title },
    })
    if (res.error) throw new Error("Failed to create session")
    return new SessionHandle(this.#client, res.data!.id, this.#opencode, opts.onSessionStateChanged)
  }
}

// ---------------------------------------------------------------------------
// ProjectHandle
// ---------------------------------------------------------------------------

export class ProjectHandle extends RpcTarget {
  #client: OpencodeClient
  #project: Project
  #opencode: Opencode | undefined

  constructor(client: OpencodeClient, project: Project, opencode?: Opencode) {
    super()
    this.#client = client
    this.#project = project
    this.#opencode = opencode
  }

  get id() { return this.#project.id }
  get worktree() { return this.#project.worktree }
  get vcs() { return this.#project.vcs }
  get time() { return this.#project.time }

  // Legacy — kept for backward compat
  async listSessions(): Promise<Session[]> {
    const res = await this.#client.session.list()
    if (res.error) throw new Error("Failed to list sessions")
    const worktree = this.#project.worktree
    return ((res.data ?? []) as Session[])
      .filter((s) => s.directory === worktree || s.directory.startsWith(worktree + "/"))
      .sort((a, b) => b.time.updated - a.time.updated)
  }

  // Returns a reactive SessionList scoped to this project's worktree
  sessionList(onStateChanged?: OnStateChangedFn<Session[]>): SessionList {
    return new SessionList(this.#client, this.#project.worktree, onStateChanged)
  }

  getSession(id: string, onSessionStateChanged?: OnStateChangedFn<SessionState>): SessionHandle {
    return new SessionHandle(this.#client, id, this.#opencode, onSessionStateChanged)
  }

  async createSession(onSessionStateChanged?: OnStateChangedFn<SessionState>): Promise<SessionHandle> {
    const res = await this.#client.session.create({
      query: { directory: this.#project.worktree },
    })
    if (res.error) throw new Error("Failed to create session")
    return new SessionHandle(this.#client, res.data!.id, this.#opencode, onSessionStateChanged)
  }
}

// ---------------------------------------------------------------------------
// SessionHandle
// ---------------------------------------------------------------------------

type SessionState = {
  status: 'running' | 'idle'
  opencode: OpencodeSession | undefined
}

export class SessionHandle extends RpcTarget {
  #client: OpencodeClient
  #sessionId: string
  #state: SessionState
  #opencode: Opencode | undefined
  #onStateChangedCallback: OnStateChangedFn<SessionState> | undefined

  constructor(
    client: OpencodeClient,
    sessionId: string,
    opencode?: Opencode,
    onStateChanged?: OnStateChangedFn<SessionState>,
  ) {
    super()
    this.#client = client
    this.#sessionId = sessionId
    this.#state = { status: 'idle', opencode: undefined }
    this.#opencode = opencode
    this.#onStateChangedCallback = onStateChanged

    if (opencode && onStateChanged) {
      opencode.addSessionListener(sessionId, (event) => {
        // Push session state changes to the client
        this.#refreshAndPush()
      })
    }
  }

  async #refreshAndPush() {
    try {
      const res = await this.#client.session.get({
        path: { id: this.#sessionId },
      })
      this.#state = {
        ...this.#state,
        opencode: res.data as OpencodeSession,
      }
      this.#onStateChangedCallback?.(this.#state)
    } catch {}
  }

  async getState(): Promise<SessionState> {
    const res = await this.#client.session.get({
      path: { id: this.#sessionId },
    })
    this.#state = {
      ...this.#state,
      opencode: res.data as OpencodeSession,
    }
    return this.#state
  }

  // Legacy alias used by existing tests
  async info(): Promise<OpencodeSession> {
    const res = await this.#client.session.get({
      path: { id: this.#sessionId },
    })
    return res.data as OpencodeSession
  }

  // Returns a reactive MessageList RPC target
  messageList(onStateChanged?: OnStateChangedFn<Message[]>): MessageList {
    return new MessageList(this.#client, this.#sessionId, this.#opencode, onStateChanged)
  }

  // Legacy — kept for backward compat with existing tests
  async messages(): Promise<Message[]> {
    const res = await this.#client.session.messages({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get messages: ${this.#sessionId}`)
    return (res.data ?? []).map(mapMessage)
  }

  async prompt(parts: PromptPartInput[]): Promise<Message> {
    const textParts = parts.map((p) => {
      if (p.type === "audio") {
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

  // Returns a reactive ChangeList RPC target
  changeList(onStateChanged?: OnStateChangedFn<File[]>): ChangeList {
    return new ChangeList(this.#client, this.#sessionId, onStateChanged)
  }

  // Derive file-level change summary from session diffs
  async changes(): Promise<File[]> {
    const res = await this.#client.session.diff({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get changes: ${this.#sessionId}`)
    return (res.data ?? []).map((d: any) => ({
      path: d.file,
      added: d.additions,
      removed: d.deletions,
      status: d.status === "deleted" ? "deleted"
        : d.status === "added" ? "added"
        : "modified" as "added" | "deleted" | "modified",
    }))
  }

  async diff(): Promise<import("./types").FileDiff[]> {
    const res = await this.#client.session.diff({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Failed to get diff: ${this.#sessionId}`)
    return (res.data ?? []) as import("./types").FileDiff[]
  }

  async revert(messageId: string): Promise<Session> {
    const res = await this.#client.session.revert({
      path: { id: this.#sessionId },
      body: { messageID: messageId },
    })
    if (res.error) throw new Error(`Revert failed: ${this.#sessionId}`)
    return res.data as Session
  }

  async share(): Promise<{ url: string }> {
    const res = await this.#client.session.share({
      path: { id: this.#sessionId },
    })
    if (res.error) throw new Error(`Share failed: ${this.#sessionId}`)
    return { url: res.data?.share?.url ?? "" }
  }
}
