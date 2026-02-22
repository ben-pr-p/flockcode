// Wrapper around the opencode SDK that maps responses to our types.

import { createOpencodeClient } from "@opencode-ai/sdk"
import type {
  Project,
  Session,
  Message,
  MessagePart,
  ChangedFile,
} from "./types"

export type OpencodeClient = ReturnType<typeof createOpencodeClient>

export function createClient(baseUrl: string): OpencodeClient {
  return createOpencodeClient({ baseUrl })
}

// --- Mappers ---

export function mapProject(
  raw: any,
  sessions: any[]
): Project {
  const projectSessions = sessions.filter((s: any) => s.projectID === raw.id)
  const activeSessions = projectSessions.filter(
    (s: any) => s.time?.updated && Date.now() - s.time.updated < 5 * 60_000
  )
  const name = raw.worktree === "/"
    ? "global"
    : raw.worktree.split("/").pop() || raw.worktree

  return {
    id: raw.id,
    name,
    path: raw.worktree,
    sessionCount: projectSessions.length,
    activeSessionCount: activeSessions.length,
    lastActiveAt: raw.time?.updated ?? raw.time?.created ?? 0,
  }
}

export function mapSession(raw: any): Session {
  return {
    id: raw.id,
    projectId: raw.projectID,
    title: raw.title ?? "",
    slug: raw.slug ?? "",
    directory: raw.directory ?? "",
    summary: raw.summary
      ? {
          additions: raw.summary.additions ?? 0,
          deletions: raw.summary.deletions ?? 0,
          files: raw.summary.files ?? 0,
        }
      : null,
    createdAt: raw.time?.created ?? 0,
    updatedAt: raw.time?.updated ?? 0,
  }
}

export function mapMessage(raw: any): Message {
  const info = raw.info
  const parts: MessagePart[] = (raw.parts ?? []).map((p: any) => {
    switch (p.type) {
      case "text":
        return { type: "text" as const, id: p.id, text: p.text }
      case "tool":
        return {
          type: "tool" as const,
          id: p.id,
          tool: p.tool,
          state: {
            status: p.state?.status ?? "pending",
            input: p.state?.input,
            output: p.state?.output,
            title: p.state?.title,
          },
        }
      case "step-start":
        return { type: "step-start" as const, id: p.id }
      case "step-finish":
        return { type: "step-finish" as const, id: p.id }
      case "reasoning":
        return { type: "reasoning" as const, id: p.id, text: p.text }
      default:
        return { type: "text" as const, id: p.id, text: `[${p.type}]` }
    }
  })

  const msg: Message = {
    id: info.id,
    sessionId: info.sessionID,
    role: info.role,
    parts,
    createdAt: info.time?.created ?? 0,
  }

  if (info.role === "assistant") {
    msg.cost = info.cost
    msg.tokens = info.tokens
      ? {
          input: info.tokens.input,
          output: info.tokens.output,
          reasoning: info.tokens.reasoning,
        }
      : undefined
    msg.finish = info.finish
  }

  return msg
}

export function mapChangedFile(raw: any): ChangedFile {
  return {
    path: raw.path,
    status: raw.status ?? "modified",
    added: raw.added ?? 0,
    removed: raw.removed ?? 0,
  }
}
