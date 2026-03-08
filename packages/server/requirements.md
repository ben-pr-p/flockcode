# Server Requirements

## Overview

The server is a Hono app running on Bun that acts as a bridge between the React Native client and an [opencode](https://github.com/sst/opencode) instance. It provides:

1. **Durable Streams** (SSE) for real-time reactive state (projects, sessions, messages) — consumed by the client via `@durable-streams/state` + TanStack DB live queries.
2. **HTTP API endpoints** for mutations (prompt, create session) and on-demand reads (file changes, diffs).
3. **Audio transcription** via TanStack AI + Gemini 3 Flash — the server transcribes voice audio before forwarding text to opencode.

---

## Technology

| Concern | Choice |
|---------|--------|
| HTTP framework | Hono 4 |
| Runtime | Bun |
| AI coding agent | OpenCode SDK (`@opencode-ai/sdk`) |
| Audio transcription | TanStack AI (`@tanstack/ai`) + Gemini 3 Flash adapter |
| Real-time state | Durable Streams (SSE) + TanStack DB |
| Transport | HTTP (REST endpoints) + SSE (state stream) |

---

## Architecture

```
┌──────────────┐    HTTP API + SSE         ┌────────────┐    SDK client    ┌──────────┐
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

---

## HTTP API Endpoints

### Mutations

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| `POST` | `/api/sessions/:sessionId/prompt` | `{ parts: PromptPartInput[] }` | `Message` | Send text/audio prompt. Audio is transcribed server-side. |
| `POST` | `/api/projects/:projectId/sessions` | `{ parts: PromptPartInput[] }` | `{ sessionId }` | Create session + send first prompt atomically. |

### Reads

| Method | Path | Returns | Notes |
|--------|------|---------|-------|
| `GET` | `/api/projects/:projectId/sessions` | `Session[]` | Sessions filtered by project worktree, sorted by updated desc. |
| `GET` | `/api/sessions/:sessionId/changes` | `ChangedFile[]` | File change summary (path, added, removed, status). |
| `GET` | `/api/diffs?session=:id` | `FileDiff[]` | Full file diffs (file, before, after). |
| `GET` | `/api/diff?session=:id&file=:path` | `FileDiff` | Single file diff. |

### Infrastructure

| Method | Path | Returns | Notes |
|--------|------|---------|-------|
| `GET` | `/` | `{ instanceId }` | Current server instance ID (changes on restart). |
| `GET` | `/health` | `{ healthy, opencodeUrl }` | Health check. |
| `ALL` | `/:instanceId/*` | SSE stream | Durable stream for state events. |

---

## Durable Streams (Real-Time State)

The server maintains a durable event stream at `/:instanceId/` that emits state events for:

- **Projects** — insert/update/delete
- **Sessions** — insert/update/delete (including status changes)
- **Messages** — insert/update/upsert/delete (including streaming text deltas)

The client subscribes via SSE and feeds events into TanStack DB collections for reactive live queries. The instance ID changes on every server restart so clients can detect restarts and re-subscribe.

---

## Audio Transcription

Transcription happens server-side in the prompt endpoint. When the client sends a `PromptPartInput` with `type: "audio"`, the server:

1. Fetches conversation context (recent messages) for better transcription accuracy
2. Transcribes via TanStack AI + Gemini 3 Flash with a system prompt tuned for coding agent voice commands
3. Forwards the transcribed text to opencode

```ts
type PromptPartInput =
  | { type: "text"; text: string }
  | { type: "audio"; audioData: string; mimeType?: string }  // base64 encoded
```

---

## Client-Side Integration

| Data | Source | Client mechanism |
|------|--------|-----------------|
| Projects list | Durable stream | `useStateQuery` (live query) |
| Sessions list | Durable stream | `useStateQuery` (live query) |
| Messages | Durable stream | `useStateQuery` (live query) |
| File changes | HTTP GET | `useChanges` hook (polling) |
| File diffs | HTTP GET | `useDiffs` hook (polling) |
| Send prompt | HTTP POST | `sendPrompt()` fetch call |
| Create session | HTTP POST | `createSessionWithPrompt()` fetch call |
