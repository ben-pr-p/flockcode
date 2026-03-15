# Outstanding Issues Needing QA

- **#13** — File diff viewer should display images
- **Unread session tracking** — Sessions now track read state via viewport-driven timestamps. Idle sessions with unread messages show a pulsing amber dot and bolder title text. Things to verify:
  - Amber pulsing dot appears on idle sessions that have new messages the user hasn't scrolled to
  - Dot clears (returns to static gray) after the user scrolls through the new messages
  - Read timestamp advances only based on what's visible in the viewport (not just selecting a session)
  - Read timestamp persists across server restarts (stored in persistent app state stream)
  - Green busy dot now pulses more aggressively than before (opacity down to 0.15)
  - Archiving/unarchiving a session doesn't interfere with read timestamps (separate collections)
  - Read timestamp flushes on unmount (navigating away from session) so state isn't lost
