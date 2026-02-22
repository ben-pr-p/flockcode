# Server Requirements

## Overview

The server is a Hono app running on Bun that acts as a bridge between the React Native client and an [opencode](https://github.com/sst/opencode) instance. It exposes a **Cap'n Web** RPC interface over WebSocket so the client gets a persistent, low-latency connection with promise pipelining. When the client sends voice audio, the server transcribes it using **TanStack AI** + Gemini 3 Flash before forwarding to opencode.

---

## Technology

| Concern | Choice |
|---------|--------|
| HTTP framework | Hono 4 |
| RPC layer | Cap'n Web via `@hono/capnweb` |
| Runtime | Bun |
| AI coding agent | OpenCode SDK (`@opencode-ai/sdk`) |
| Audio transcription | TanStack AI (`@tanstack/ai`) + Gemini 3 Flash adapter |
| Transport | WebSocket (primary), HTTP batch (fallback) |

---

## Architecture

```
┌──────────────┐    WebSocket (capnweb)     ┌────────────┐    SDK client    ┌──────────┐
│  React Native │ ◄──────────────────────► │  Hono Server │ ◄────────────► │ opencode │
│   (iOS app)   │                           │  (this pkg)  │                │  server  │
└──────────────┘                            └────────────┘                └──────────┘
                                                   │
                                                   │  TanStack AI
                                                   ▼
                                            ┌──────────────┐
                                            │ Gemini 3 Flash│
                                            │ (transcription)│
                                            └──────────────┘
```

The Cap'n Web RPC target wraps the OpenCode SDK client, translating the mobile app's method calls into SDK calls. The RPC connection gives us:

- **Promise pipelining** — chain calls like `api.getSession(id).messages()` in a single round trip
- **Pass-by-reference** — server objects (sessions, projects) are stubs the client calls methods on directly
- **Automatic serialization** — JSON-based, no schema files needed
- **Resource cleanup** — `Symbol.dispose` / `using` for proper lifecycle management

---

## Cap'n Web RPC API

### Root object: `Api`

The single RPC target exposed at `POST|GET /rpc`. The client connects with:

```ts
using api = newWebSocketRpcSession<Api>("ws://<host>/rpc")
```

### `Api` methods

| Method | Returns | Notes |
|--------|---------|-------|
| `health()` | `{ ok: boolean, version: string }` | Server + opencode health |
| `listProjects()` | `Project[]` | All projects, sorted by `lastActiveAt` desc |
| `getProject(id: string)` | `Project` | Single project by ID |
| `listSessions(projectId?: string)` | `Session[]` | All sessions, optionally filtered by project |
| `getSession(id: string)` | `SessionHandle` | Returns a **live object** (see below) |
| `createSession(opts: { title?: string })` | `SessionHandle` | Creates via opencode SDK, returns handle |
| `deleteSession(id: string)` | `void` | Deletes session |

### `SessionHandle` (pass-by-reference RPC object)

A `SessionHandle` is an `RpcTarget` subclass representing a single session. Because Cap'n Web passes class instances by reference, the client receives a stub and calls methods on it directly — no need to pass the session ID repeatedly.

| Method | Returns | Notes |
|--------|---------|-------|
| `info()` | `Session` | Session metadata |
| `messages()` | `Message[]` | All messages, sorted by `createdAt` asc |
| `prompt(parts: MessagePart[])` | `AssistantMessage` | Send user message. If parts contain audio, server transcribes via Gemini 3 Flash first, then forwards text to `opencode.session.prompt()` |
| `abort()` | `void` | Cancel in-flight prompt |
| `changes()` | `ChangedFile[]` | Git diff for session's branch. Calls `opencode.file.status()` |
| `revert(messageId: string)` | `void` | Undo a message via `opencode.session.revert()` |
| `share()` | `{ url: string }` | Make session shareable |

### `MessagePart` union

```ts
type MessagePart =
  | { type: "text"; text: string }
  | { type: "audio"; audioData: ArrayBuffer }  // raw audio, server transcribes
```

When the client sends an audio part, the server transcribes it via TanStack AI + Gemini 3 Flash before forwarding the resulting text to the opencode SDK. See the Transcription section below.

---

## Data Types

These mirror the OpenCode SDK types but are trimmed to what the client actually needs.

### `Project`

```ts
{
  id: string
  name: string
  path: string
  sessionCount: number
  activeSessionCount: number
  lastActiveAt: number
}
```

Derived from `opencode.project.list()` and `opencode.session.list()` (to compute session counts).

### `Session`

```ts
{
  id: string
  projectId: string
  name: string
  branchName: string | null
  status: "active" | "idle"
  createdAt: number
  updatedAt: number
}
```

### `Message`

```ts
{
  id: string
  sessionId: string
  role: "user" | "assistant"
  type: "text" | "voice" | "tool_call" | "tool_output" | "status"
  content: string
  toolName: string | null
  toolMeta: Record<string, unknown> | null
  createdAt: number
}
```

Mapped from the opencode SDK's `Message` with `parts` flattened. The `syncStatus` field on the client type is client-only (tracks local send state) and is not part of the server type.

### `ChangedFile`

```ts
{
  path: string
  additions: string[]
  deletions: string[]
}
```

Derived from `opencode.file.status()` and `opencode.file.read({ format: "patch" })`.

---

## Streaming & Events

### Session event stream

The opencode SDK provides `opencode.event.subscribe()` which returns an async iterable of server-sent events. The server should bridge these to the client via Cap'n Web's stream support (streams are pass-by-value with automatic flow control).

```ts
class SessionHandle extends RpcTarget {
  async *events(): AsyncIterable<SessionEvent> {
    // Filter opencode events to this session
    // Yield message deltas, status changes, etc.
  }
}
```

The client subscribes to this to get real-time updates (new messages, status changes, agent progress) without polling.

### Event types

```ts
type SessionEvent =
  | { type: "message.delta"; messageId: string; content: string }
  | { type: "message.complete"; message: Message }
  | { type: "status.change"; status: "active" | "idle" }
  | { type: "tool.start"; toolName: string; messageId: string }
  | { type: "tool.complete"; toolName: string; messageId: string; output: string }
```

---

## Audio Transcription (TanStack AI + Gemini 3 Flash)

Transcription happens **server-side** within the `SessionHandle.prompt()` method. When the client sends a `MessagePart` with `type: "audio"`, the server transcribes it before forwarding to opencode. This keeps the client simple — it just sends raw audio bytes over the Cap'n Web RPC connection and doesn't need to manage a separate transcription step.

### Server-side flow

Inside `SessionHandle.prompt()`:

```ts
import { chat } from "@tanstack/ai"
import { gemini } from "@tanstack/ai-gemini"

class SessionHandle extends RpcTarget {
  async prompt(parts: MessagePart[]): Promise<AssistantMessage> {
    // Transcribe any audio parts
    const textParts = await Promise.all(
      parts.map(async (part) => {
        if (part.type === "audio") {
          const transcription = await this.transcribe(part.audioData)
          return { type: "text" as const, text: transcription }
        }
        return part
      })
    )

    // Forward text to opencode
    return opencode.session.prompt({
      path: { id: this.sessionId },
      body: { parts: textParts }
    })
  }

  private async transcribe(audioData: ArrayBuffer): Promise<string> {
    const stream = chat({
      adapter: gemini("gemini-3-flash"),
      messages: [{
        role: "user",
        content: [
          { type: "audio", audio: audioData },
          { type: "text", text: "Transcribe this audio exactly." }
        ]
      }]
    })

    // Collect the full transcription from the stream
    let text = ""
    for await (const chunk of stream) {
      text += chunk.content
    }
    return text
  }
}
```

### Optional: standalone transcription endpoint

A separate endpoint can also be exposed for cases where the client wants to show a transcription preview before sending (e.g. hands-free mode confirmation):

```
POST /api/transcribe
Content-Type: multipart/form-data
Body: { audio: File }
Response: SSE stream → final text transcription
```

### Client flow

1. User records audio on device
2. Client calls `sessionHandle.prompt([{ type: "audio", audioData }])` over Cap'n Web
3. Server transcribes audio via Gemini 3 Flash
4. Server forwards transcribed text to opencode
5. Response streams back to client via Cap'n Web events

---

## Hono Route Setup

```ts
import { Hono } from "hono"
import { upgradeWebSocket, websocket } from "hono/bun"
import { newRpcResponse } from "@hono/capnweb"
import { createOpencodeClient } from "@opencode-ai/sdk"

const opencode = createOpencodeClient({ baseUrl: "http://localhost:4096" })
const app = new Hono()

// Cap'n Web RPC endpoint
app.all("/rpc", (c) => {
  return newRpcResponse(c, new Api(opencode), { upgradeWebSocket })
})

// Health
app.get("/health", (c) => c.json({ healthy: true }))

export default {
  port: 3000,
  fetch: app.fetch,
  websocket,
}
```

---

## Client-Side Hook Mapping

How each existing client hook maps to server RPC calls:

| Client Hook | Current Source | Server Method |
|-------------|---------------|---------------|
| `useProjects()` | `FIXTURE_PROJECTS` | `api.listProjects()` |
| `useSession(id)` | `FIXTURE_SESSIONS` | `api.getSession(id).info()` |
| `useSessionMessages(id)` | `FIXTURE_MESSAGES` | `sessionHandle.messages()` + `sessionHandle.events()` for live updates |
| `useChanges(id)` | `FIXTURE_CHANGES` | `sessionHandle.changes()` |
| `useSidebarSessions(query)` | `FIXTURE_SESSIONS` joined w/ projects | `api.listSessions()` + `api.listProjects()`, client-side join & filter |
| `useMusicPlayer()` | Fixture data | Not server-backed (Spotify SDK, client-only) |
| `useSettings()` | Fixture data | Mostly client-only (AsyncStorage). `connection` status derived from WebSocket state |

### Unimplemented actions → server methods

| Client Action | Server Method |
|---------------|---------------|
| Send message (text) | `sessionHandle.prompt([{ type: "text", text }])` |
| Send message (voice) | `sessionHandle.prompt([{ type: "audio", audioData }])` — server transcribes internally |
| Create session | `api.createSession({ title })` |
| Select session | `api.getSession(id)` (get new handle) |
| Delete session | `api.deleteSession(id)` |
| Stop agent | `sessionHandle.abort()` |
| Revert message | `sessionHandle.revert(messageId)` |
| Share session | `sessionHandle.share()` |

---

## Resolved Decisions

1. **Bun WebSocket** — Hono handles this natively via `import { upgradeWebSocket, websocket } from "hono/bun"`. Export `websocket` from the default object.

2. **OpenCode connection model** — The server expects an opencode instance to already be running (e.g. on `localhost:4096`). The user starts opencode on their machine, then the mobile client connects to this Hono server which proxies to opencode.

3. **Project/session count aggregation** — Computed server-side. `listProjects()` calls both `opencode.project.list()` and `opencode.session.list()`, then aggregates `sessionCount` and `activeSessionCount` per project before returning.

4. **File diffs** — Computed server-side in `SessionHandle.changes()`. Calls `opencode.file.status()` to get changed file paths, then `opencode.file.read({ format: "patch" })` for each, and parses the unified diff into `{ path, additions, deletions }`.

5. **Multi-project support** — Assumed supported by the opencode SDK. Will revisit if needed.
