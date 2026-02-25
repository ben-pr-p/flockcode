# RPC Target Hierarchy

```
Api (root)
│
├── projectList(onStateChanged?) ──► ProjectList
│   └── getState() → Project[]
│
├── listProjects() → Project[]                    (legacy, returns data directly)
│
├── getProject(id) ──► ProjectHandle
│   ├── .id, .worktree, .vcs, .time               (getters)
│   ├── sessionList(onStateChanged?) ──► SessionList
│   │   └── getState() → Session[]
│   ├── listSessions() → Session[]                (legacy)
│   ├── getSession(id, onStateChanged?) ──► SessionHandle
│   └── createSession(onStateChanged?) ──► SessionHandle
│
├── sessionList(worktree, onStateChanged?) ──► SessionList
│   └── getState() → Session[]                  (filtered by directory prefix)
│
├── listSessions() → Session[]                    (legacy, unfiltered)
│
├── getSession(id, onStateChanged?) ──► SessionHandle
│   ├── getState() → { status, opencode }
│   ├── info() → OpencodeSession                  (legacy)
│   ├── messageList(onStateChanged?) ──► MessageList
│   │   └── getState() → Message[]
│   ├── messages() → Message[]                    (legacy)
│   ├── changeList(onStateChanged?) ──► ChangeList
│   │   └── getState() → ChangedFile[]
│   ├── changes() → ChangedFile[]                 (legacy)
│   ├── prompt(parts) → Message
│   ├── abort() → void
│   ├── revert(messageId) → Session
│   └── share() → { url }
│
└── createSession({ title?, onStateChanged? }) ──► SessionHandle
```

## Component → Hook mounting

```
App
├── EmptySession                                   (no hooks, shown when no sessionId)
├── SessionContent [sessionId]
│   ├── useSession(sessionId)                      ← mounts first
│   └── SessionDataLoader                          ← only mounts once session loaded
│       ├── useSessionMessages(sessionId)
│       ├── useChanges(sessionId)
│       ├── SessionScreen                          (phone layout, pure presentational)
│       └── SplitLayout                            (tablet layout, pure presentational)
├── SessionsSidebar
│   └── useSidebarSessions(worktree, searchQuery)  ← only mounts when worktree selected
└── ProjectsSidebar
    └── useProjects()
```

## Hooks → RPC target mapping

| Hook                  | Mounted in             | RPC call                          | Returns        |
|-----------------------|------------------------|-----------------------------------|----------------|
| `useProjects`         | `ProjectsSidebar`      | `api.projectList().getState()`    | `Project[]`    |
| `useSidebarSessions`  | `SessionListContent`   | `api.sessionList(wt).getState()`  | `Session[]`    |
| `useSession`          | `SessionContent`       | `api.getSession(id).info()`       | session info   |
| `useSessionMessages`  | `SessionDataLoader`    | `api.getSession(id).messages()`   | `Message[]`    |
| `useChanges`          | `SessionDataLoader`    | `api.getSession(id).changes()`    | `ChangedFile[]`|
