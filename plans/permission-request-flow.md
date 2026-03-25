# Permission Request Flow — Implementation Plan

Implements end-to-end agent permission request handling: the server tracks pending
permission requests from OpenCode, exposes them via the ephemeral stream and an oRPC
reply endpoint, and the native client replaces the voice input area with approval
buttons when a permission is pending.

## Data Model

The v2 SDK provides a `PermissionRequest` type:

```typescript
type PermissionRequest = {
  id: string               // unique request ID (used as the reply key)
  sessionID: string        // which session triggered this
  permission: string       // permission name: "bash", "edit", "read", etc.
  patterns: Array<string>  // glob patterns the permission applies to
  metadata: Record<string, unknown>
  always: Array<string>    // options available for permanent rules
  tool?: {
    messageID: string
    callID: string
  }
}
```

Reply options are: `"once"` | `"always"` | `"reject"`.

## Architecture

```
OpenCode SSE events
  │
  ▼
handleOpencodeEvent()          (opencode.ts — already wired)
  │
  ├─ permission.asked  ──►  StateStream.permissionAsked()
  │                           │
  │                           ├─ Store in #pendingPermissions map
  │                           └─ Emit ephemeral event {type: "permissionRequest", key: sessionId}
  │
  └─ permission.replied ──►  StateStream.permissionReplied()
                               │
                               ├─ Remove from #pendingPermissions map
                               └─ Emit ephemeral event {type: "permissionRequest", key: sessionId, delete}
                                    │
                                    ▼
                          Ephemeral durable stream
                                    │
                                    ▼
                          Native client (live query)
                                    │
                                    ▼
                          usePendingPermission(backendUrl, sessionId)
                                    │
                                    ▼
                          SessionScreen / SplitLayout
                            ├─ permission pending → <PermissionRequestBar>
                            └─ no permission      → <VoiceInputArea>
```

Reply flow (user taps a button):

```
Native: oRPC call permissions.reply({ requestId, reply })
  │
  ▼
Server: router/permissions.ts
  │
  ▼
client.permission.reply({ requestID, reply })   ──►  OpenCode
  │
  ▼
OpenCode fires permission.replied event ──► StateStream clears it
```

## Implementation Steps

### 1. Server: Track pending permissions in StateStream

**File: `packages/server/src/state-stream.ts`**

- Add a `#pendingPermissions: Map<string, PermissionRequestValue>` field keyed by
  `sessionId` (one pending permission per session — OpenCode blocks until replied).
- Add `"permissionRequest"` to the `EphemeralEventType` union.
- Implement `permissionAsked(permission)`:
  - Store in `#pendingPermissions` keyed by `permission.sessionID`.
  - Emit ephemeral event `{ type: "permissionRequest", key: permission.sessionID, value: { ... }, headers: { operation: "upsert" } }`.
- Implement `permissionReplied(sessionId, requestId, reply)`:
  - Delete from `#pendingPermissions` by `sessionId`.
  - Emit ephemeral event `{ type: "permissionRequest", key: sessionId, headers: { operation: "delete" } }`.
- Add `pendingPermissions` to `getEphemeralSnapshot()` return value.

The value shape emitted to the client:

```typescript
type PermissionRequestValue = {
  sessionId: string
  requestId: string
  permission: string       // "bash", "edit", "read", etc.
  patterns: string[]       // e.g. ["src/**/*.ts"]
  description: string      // human-readable summary, built from permission + patterns
}
```

The `description` field is synthesized server-side from `permission` and `patterns`
(e.g. `"Run bash command"`, `"Edit files matching src/**/*.ts"`) so the client
doesn't need to know how to format permission names.

### 2. Server: Add permissions oRPC endpoint

**New file: `packages/server/src/router/permissions.ts`**

```typescript
export const permissions = {
  reply: base
    .input(z.object({
      requestId: z.string(),
      reply: z.enum(["once", "always", "reject"]),
    }))
    .handler(async ({ input, context }) => {
      const res = await context.client.permission.reply({
        requestID: input.requestId,
        reply: input.reply,
      })
      if (res.error) throw new ORPCError(...)
      return { success: true }
    }),
}
```

**File: `packages/server/src/router/index.ts`**

- Import and add `permissions` to the router object.

### 3. Native: Add permission request to ephemeral stream schema

**File: `packages/native/lib/stream-db.ts`**

- Add `PermissionRequestValue` type:

```typescript
type PermissionRequestValue = {
  sessionId: string
  requestId: string
  permission: string
  patterns: string[]
  description: string
}
```

- Add `permissionRequests` collection to `ephemeralStateDef`:

```typescript
permissionRequests: {
  schema: passthrough<PermissionRequestValue>(),
  type: 'permissionRequest' as const,
  primaryKey: 'sessionId' as const,
},
```

### 4. Native: Add usePendingPermission hook

**New file: `packages/native/hooks/usePendingPermission.ts`**

Follows the same pattern as `useSessionStatus.ts`:

```typescript
export function usePendingPermission(
  backendUrl: BackendUrl,
  sessionId: string
): PermissionRequestValue | null {
  const { data } = useBackendEphemeralStateQuery<PermissionRequestValue>(
    backendUrl,
    (db, q) =>
      q.from({ permissionRequests: db.collections.permissionRequests })
        .where(({ permissionRequests }) =>
          eq(permissionRequests.sessionId, sessionId)),
    [sessionId]
  )
  return data?.[0] ?? null
}
```

### 5. Native: PermissionRequestBar component

**New file: `packages/native/components/PermissionRequestBar.tsx`**

Replaces `VoiceInputArea` at the bottom of the screen when a permission is pending.
Sized to occupy the same vertical space as `VoiceInputArea` so the layout doesn't
jump. Uses `useSafeAreaInsets()` for bottom padding, same as `VoiceInputArea`.

Layout (bottom to top):

```
┌──────────────────────────────────────────────┐
│  🔒 Bash: run command in src/               │  ← permission + patterns
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Reject   │  │   Once   │  │  Always  │   │  ← three action buttons
│  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────────────────────────────┘
```

- Top row: icon + `description` text (from server).
- Bottom row: three buttons in a horizontal `flex-row`.
  - **Reject** — muted/destructive style (gray or red outline).
  - **Once** — primary style (filled amber, matching the mic button color).
  - **Always** — secondary style (outline).
- Each button calls the oRPC `permissions.reply` endpoint.
- While the reply is in-flight, all three buttons show a loading state (disabled +
  spinner on the tapped button) to prevent double-submission.
- On reply success, the `permission.replied` event removes it from the ephemeral
  stream and the component unmounts, restoring `VoiceInputArea`.

### 6. Native: Swap VoiceInputArea for PermissionRequestBar

**File: `packages/native/components/SessionScreen.tsx`** (~line 145)

Currently:
```tsx
{!session.parentID && (
  <VoiceInputArea ... />
)}
```

Change to:
```tsx
{!session.parentID && (
  pendingPermission
    ? <PermissionRequestBar permission={pendingPermission} backendUrl={backendUrl} />
    : <VoiceInputArea ... />
)}
```

Where `pendingPermission` comes from the `usePendingPermission` hook called in
`SessionView` (in `SessionContent.tsx`) and threaded down as a prop.

**File: `packages/native/components/SplitLayout.tsx`** (~line 229)

Same conditional swap for the iPad layout.

### 7. Snapshot bootstrap

**File: `packages/server/src/router/snapshot.ts`**

The `getEphemeralSnapshot()` already returns session statuses and worktree statuses.
After step 1 adds `pendingPermissions` to the snapshot, the native client will
receive any pending permissions on connect — no special handling needed since the
ephemeral stream schema already supports it after step 3.

## File Change Summary

| File | Change |
|------|--------|
| `server/src/state-stream.ts` | Track pending permissions, emit ephemeral events, include in snapshot |
| `server/src/router/permissions.ts` | **New** — oRPC `permissions.reply` endpoint |
| `server/src/router/index.ts` | Register `permissions` in router |
| `native/lib/stream-db.ts` | Add `PermissionRequestValue` type and `permissionRequests` collection |
| `native/hooks/usePendingPermission.ts` | **New** — live query hook |
| `native/components/PermissionRequestBar.tsx` | **New** — approval/reject UI |
| `native/components/SessionContent.tsx` | Call `usePendingPermission`, pass down |
| `native/components/SessionScreen.tsx` | Conditional render: permission bar vs voice input |
| `native/components/SplitLayout.tsx` | Same conditional render for iPad |

## Edge Cases

- **Multiple permissions**: OpenCode sends one permission request at a time per
  session (it blocks until replied). The `Map<sessionId, permission>` naturally
  handles this — one pending permission per session. If OpenCode ever sends multiple,
  only the latest is shown (upsert by sessionId).

- **Stale permissions on reconnect**: The snapshot includes pending permissions, and
  `permission.replied` events clean them up. If the server restarts, the
  `#pendingPermissions` map is empty and any stale client state gets cleared on the
  next ephemeral stream reconnect.

- **Race condition (reply in-flight when permission is cleared)**: The reply endpoint
  may return a 404 if the permission was already resolved (e.g. timeout on OpenCode
  side). The client should handle this gracefully — the ephemeral event will have
  already removed the permission bar.

- **Session idle clears permissions**: When a session goes idle, any pending
  permission for it should be cleared from the map (safety net).
