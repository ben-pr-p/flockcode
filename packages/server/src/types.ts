// Types exposed to the client via Cap'n Web RPC.
// These are trimmed/mapped versions of the opencode SDK types.

export interface Project {
  id: string
  name: string
  path: string
  sessionCount: number
  activeSessionCount: number
  lastActiveAt: number
}

export interface Session {
  id: string
  projectId: string
  title: string
  slug: string
  directory: string
  summary: {
    additions: number
    deletions: number
    files: number
  } | null
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant"
  parts: MessagePart[]
  createdAt: number
  // assistant-specific
  cost?: number
  tokens?: {
    input: number
    output: number
    reasoning: number
  }
  finish?: string
}

export type MessagePart =
  | { type: "text"; id: string; text: string }
  | {
      type: "tool"
      id: string
      tool: string
      state: {
        status: string
        input?: unknown
        output?: string
        title?: string
      }
    }
  | { type: "step-start"; id: string }
  | { type: "step-finish"; id: string }
  | { type: "reasoning"; id: string; text?: string }

export interface ChangedFile {
  path: string
  status: "added" | "deleted" | "modified"
  added: number
  removed: number
}

export type TextPartInput = { type: "text"; text: string }
export type AudioPartInput = { type: "audio"; audioData: ArrayBuffer }
export type PromptPartInput = TextPartInput | AudioPartInput
