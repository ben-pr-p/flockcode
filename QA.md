# Outstanding Issues Needing QA

## Multi-backend rebase — features from main to verify still work

These features were all added to main while the multi-backend branch was in flight. The rebase merged them together — verify each still works correctly.

## Found Issues
- [ ] Updating the agent mode sends the message but discovering the mode on the session sidebar fails and the session is reset to build on refresh
- [ ] Agent mode does not appear on session sidebar for pinned projects, only the selected project.
- [ ] Changing the model in the model selector DOES NOT ONLY affects the current session, it does affect other sessions as well. Undesireable behavior.
- [ ] Changing the model in the model selector DOES NOT ONLY affects the current session, it does affect other sessions as well. Undesireable behavior.
- [ ] Unqualified project screen is broken, doesn't navigate to session

### Agent & command selector
- [x] Tapping the agent name button (bottom-left of input area) opens the `AgentCommandSheet`
- [x] Sheet lists available agents fetched from the current backend; selecting one updates the agent name shown in the button
- [x] Sheet lists available commands; selecting one queues it as a `pendingCommand` (shown as a chip above the input)
- [x] Tapping the chip's dismiss button clears the queued command
- [x] Sending a message while a command is queued executes it via the `/command` endpoint, not the normal `/prompt` endpoint
- [x] Agent catalog is re-fetched when the backend connection transitions to `connected`
- [x] Worktree sessions show the correct agent name badge in the session sidebar

### Per-session model selection (effectiveModel)
- [-] Changing the model in the model selector only affects the current session, not other sessions
- [-] `effectiveModel` priority: session-level override → last model used in session (from `sessionModelInfo`) → server default
- [-] After changing model mid-session and navigating away then back, the override resets (it's local state, not persisted)

### Worktree status badges in session sidebar
- [x] Sessions running in a worktree show a status badge: "Uncommitted", "Awaiting merge", or "Merged"
- [ ] Badge updates in real-time as worktree state changes
- [ ] Non-worktree sessions show no badge
- [ ] Fresh branches and branches with only committed (not merged) changes show "Awaiting merge", not "Merged"

### Pinned projects with cross-project sessions in sidebar
- [x] Long-pressing a project in the projects sidebar pins it
- [x] Pinned projects appear as collapsible groups at the top of the sessions sidebar, showing up to 3 recent sessions each
- [x] The current project's sessions do not appear in the pinned group (they're already in the main list)
- [x] Tapping the `+` next to a pinned project group creates a new session for that project
- [x] Unpinning removes the group from the sidebar

### Tool call expanded views
- [x] Tapping a tool call row on iPhone opens a modal with the expanded tool call detail
- [x] On iPad landscape, the expanded view appears in the right panel instead of a modal
- [x] Each tool type (bash, file read, file write, etc.) renders its own specialised view
- [x] Tool call status (running / success / error) is shown correctly

### File diff viewer — image display
- [x] Files with image extensions (png, jpg, gif, svg, etc.) render as images in the diff viewer, not as text/hex

### Navigation — skip archived & child sessions on auto-navigate
- [ ] When opening a project (from projects sidebar or on app launch), the app navigates to the most recent *top-level, non-archived* session
- [ ] Archived sessions are skipped
- [ ] Child (worktree sub-) sessions are skipped
- [ ] If no eligible session exists, navigates to new-session
- [x] A loading spinner is shown while the merged query resolves — the "Select a session" placeholder is never visible

## Previously logged

- [ ] **#13** — File diff viewer should display images
- [ ] **Unread session tracking** — Sessions now track read state via viewport-driven timestamps. Idle sessions with unread messages show a pulsing amber dot and bolder title text. Things to verify:
  - [ ] Amber pulsing dot appears on idle sessions that have new messages the user hasn't scrolled to
  - [ ] Dot clears (returns to static gray) after the user scrolls through the new messages
  - [ ] Read timestamp advances only based on what's visible in the viewport (not just selecting a session)
  - [ ] Read timestamp persists across server restarts (stored in persistent app state stream)
  - [ ] Green busy dot now pulses more aggressively than before (opacity down to 0.15)
  - [ ] Archiving/unarchiving a session doesn't interfere with read timestamps (separate collections)
  - [ ] Read timestamp flushes on unmount (navigating away from session) so state isn't lost
