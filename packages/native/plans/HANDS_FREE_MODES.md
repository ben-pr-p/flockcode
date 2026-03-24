# Hands-Free Modes: Washing Dishes & Walking

## Background

The headphone pause button is now the primary trigger for hands-free interaction (the user figured out that the pause button on headphones works great). We're replacing the "Hands-free auto-record" switch in Settings with a richer mode system surfaced directly from the headphone button itself.

---

## Modes

### 1. Washing Dishes
- Assumes the user **can look at the screen**, just can't touch it.
- Behavior: headphone button press → records → sends audio to agent as normal.
- **No TTS response**. The session plays out on screen.
- Icon: water droplet / dish icon (e.g. `Droplets` from lucide-react-native)

### 2. Walking
- Assumes the user **cannot look at the screen**.
- When the agent finishes a session (status goes `busy → idle`), a **completion sound** plays.
- When the user sends an audio message via headphone button:
  1. Audio is transcribed (existing Gemini transcription).
  2. Gemini Flash **routes** the message:
     - **Forward to agent** if the user is asking the agent to continue/do something.
     - **Respond directly** if the user is asking a question about the session.
  3. If responding directly:
     - Gemini Flash generates a terse text response.
     - A cheaper Gemini TTS model generates audio.
     - The audio is returned to the client and **played back through the headphones**.
  4. If forwarding: normal `sendPrompt()` flow. Agent processes it.
- All of this must work **while the phone is locked**.
- Icon: footprints / walking icon (e.g. `Footprints` from lucide-react-native)

---

## What to Remove

- The **"Hands-free auto-record" switch** from the Settings screen (`SettingsScreen.tsx`).
- The `AutoRecordBehavior` info box below it.
- The `handsFreeAutoRecordAtom` from `state/settings.ts`.
- All threading of `handsFreeAutoRecord` / `onHandsFreeAutoRecordChange` through:
  - `useSettings.ts`
  - `SessionSettings` interface in `SessionContent.tsx`
  - `SplitLayout.tsx`
  - `SessionScreen.tsx` (if threaded there)
  - `SettingsScreen.tsx` props

---

## What to Add / Change

### A. State

**`state/settings.ts`**
- Remove `handsFreeAutoRecordAtom`.
- Add `handsFreeMode` atom:
  ```ts
  export type HandsFreeMode = 'washing-dishes' | 'walking'
  export const handsFreeModeAtom = atomWithStorage<HandsFreeMode>(
    'settings:handsFreeMode',
    'washing-dishes',
    asyncStorageAdapter<HandsFreeMode>(),
  )
  ```

### B. UI — Headphone Button Changes

**`components/VoiceInputArea.tsx`**

Current behavior: tapping the headphone button toggles hands-free on/off.
New behavior:
- **Single tap**: same (toggle hands-free on/off).
- **Long press**: opens the `HandsFreeModePicker` modal to switch between modes.
- Button is **bigger** (~44×44 from 36×36) and **positioned to the left** (before the mic button in the row, not after the agent selector).
- Icon changes based on mode:
  - `Droplets` icon → Washing Dishes mode
  - `Footprints` icon → Walking mode
- Active color: purple (as before).

### C. Mode Picker Modal

**New file: `components/HandsFreeModePicker.tsx`**

Simple centered modal with two options. Design pattern: centered card with `animationType="fade"`, stone background, dark mode support (like the iPad settings modal in `SplitLayout.tsx`).

```
┌─────────────────────────────┐
│    Hands-Free Mode          │
│  ┌──────────┐ ┌──────────┐  │
│  │ 💧        │ │ 🚶        │  │
│  │ Washing  │ │ Walking  │  │
│  │ Dishes   │ │          │  │
│  └──────────┘ └──────────┘  │
└─────────────────────────────┘
```

Props:
- `visible: boolean`
- `onClose: () => void`
- `mode: HandsFreeMode`
- `onModeChange: (mode: HandsFreeMode) => void`

### D. Native Module — Sound Playback

**`modules/hands-free-media/ios/HandsFreeMediaModule.swift`**

Add two new methods:

1. **`playSound(soundName: String)`** — plays a bundled short audio file (e.g., `completion.wav`) through the current audio session. Used for the "agent done" notification in Walking mode.

2. **`playAudioData(base64: String, mimeType: String)`** — plays raw base64 audio data (the TTS response from the server) through the current audio session.

Both should:
- Work through the existing `.playback` audio session (which is active when hands-free is on).
- Work while the phone is locked.
- Return a Promise.

**`modules/hands-free-media/src/HandsFreeMediaModule.ts`**

Expose the two new methods in the TypeScript declaration.

**`assets/`**

Bundle a short notification chime (`completion.wav` or `.mp3`). Can reuse the existing `silence.mp3` pattern — a short ~1s chime.

### E. Completion Sound — Walking Mode

**`hooks/useHandsFreeMode.ts`**

Add a new parameter `session?: { status: string }` (or pass it separately).

When:
- `handsFreeMode === 'walking'`
- AND `isActive === true`
- AND `session.status` transitions from `'busy'` to `'idle'`

→ Call `HandsFreeMedia.playSound('completion')`.

Alternatively, this logic could live in `SessionContent.tsx` as a `useEffect` watching `session.status`.

### F. Server — New Voice Prompt Endpoint

**New file: `packages/server/src/voice-prompt.ts`**

```ts
export async function handlePhoneLockedVoicePrompt(
  client: OpencodeClient,
  sessionId: string,
  audioData: string,
  mimeType: string,
  directory?: string,
  model?: { providerID: string; modelID: string },
): Promise<PhoneLockedVoicePromptResult>

export type PhoneLockedVoicePromptResult =
  | { action: 'forwarded' }
  | { action: 'responded'; text: string; audioData: string; mimeType: string }
```

Logic:
1. Fetch conversation context (last N messages).
2. Transcribe audio via existing `transcribeAudio()`.
3. Stream a single Gemini Flash call that both routes AND responds in one pass using an XML envelope.
4. Parse the stream: the opening tag determines the action immediately.
5. If `<forward>`: fire `sendPrompt()` in background with transcribed text, return `{ action: 'forwarded' }`.
6. If `<respond>`: accumulate the streamed text body, generate TTS, return `{ action: 'responded', text, audioData, mimeType }`.

**Streaming XML envelope approach**

The key insight is that routing and responding are combined into one streaming Gemini call. The model streams its output starting with an XML tag that signals the action — we don't need to wait for the full response to know which path we're on.

Prompt:
```
You are a voice assistant proxy for an AI coding agent. The user has sent a voice message (transcribed below).
Decide whether to handle the message yourself or forward it to the coding agent.

FORWARD to the agent if the user is asking it to do something, giving a new instruction, or continuing/modifying a task.
RESPOND yourself if the user is asking a question about what the agent just did, asking for a status update, or asking what changed.

If forwarding, respond with ONLY:
<forward/>

If responding, reply with:
<respond>
[your terse response here, suitable for text-to-speech — 1-3 sentences max]
</respond>

Conversation context:
{context}

User message: "{transcription}"
```

**Stream parsing**

Read the stream token by token:
- First non-whitespace content will be either `<forward/>` or `<respond>`.
- `<forward/>` → immediately fire `sendPrompt()` and return.
- `<respond>` → buffer tokens until `</respond>`, extract the body text.

**`generateTTS`** uses Gemini TTS API (e.g., `gemini-2.5-flash-preview-tts` or similar). Returns base64 audio + mimeType.

**`packages/server/src/app.ts`**

Add new endpoint:
```ts
.post(
  "/sessions/:sessionId/voice-prompt",
  zValidator("json", PhoneLockedVoicePromptSchema),
  async (c) => { ... }
)
```

Where `PhoneLockedVoicePromptSchema`:
```ts
z.object({
  audioData: z.string(),
  mimeType: z.string().optional(),
  model: z.object({ providerID: z.string(), modelID: z.string() }).optional(),
})
```

### G. Client — Walking Mode Audio Send

**`components/SessionContent.tsx`**

In `ExistingSessionDataLoader` (and potentially `NewSessionDataLoader`):

- Add `handlePhoneLockedVoicePrompt` callback that posts to the new `/sessions/:sessionId/voice-prompt` endpoint.
- Pass this to `SessionView` alongside `onSendAudio`.

**`hooks/useHandsFreeMode.ts`** or **`SessionView`**

When `handsFreeMode === 'walking'` and audio is received from `onRecordingStopped`:
- Call `onPhoneLockedVoicePrompt(audioData, mimeType)` instead of `onSendAudio`.
- On response:
  - `{ action: 'forwarded' }`: nothing extra to do.
  - `{ action: 'responded', audioData, mimeType }`: call `HandsFreeMedia.playAudioData(audioData, mimeType)`.

---

## Background / Lock Screen Considerations

The phone is locked → the app must still:
1. **Send HTTP requests**: The CallKit active call keeps the app alive during recording + the brief processing period. Background URLSession tasks may be needed for longer server round-trips.
2. **Play audio**: The native module's `.playback` audio session + background audio mode (`UIBackgroundModes: audio` in `Info.plist`) already enables this. The existing `silence.mp3` loop keeps the audio session active. Playing TTS or the chime through the same session will work.
3. **Detect session completion** (busy → idle): This depends on the SSE/durable-stream WebSocket connection staying alive. The app's background audio mode should keep the network connection alive long enough. The completion sound fires on transition detection.

---

## File Change Summary

| File | Action |
|------|--------|
| `packages/native/state/settings.ts` | Remove `handsFreeAutoRecordAtom`, add `handsFreeModeAtom` |
| `packages/native/hooks/useSettings.ts` | Remove `handsFreeAutoRecord` return |
| `packages/native/components/SettingsScreen.tsx` | Remove hands-free switch + AutoRecordBehavior, remove related props |
| `packages/native/components/SessionContent.tsx` | Remove settings threading, add voice-prompt flow, add completion sound |
| `packages/native/components/SplitLayout.tsx` | Remove hands-free settings prop threading |
| `packages/native/components/SessionScreen.tsx` | Remove hands-free settings prop threading |
| `packages/native/components/VoiceInputArea.tsx` | Bigger button, long-press, mode icon |
| `packages/native/components/HandsFreeModePicker.tsx` | **New** — mode picker modal |
| `packages/native/hooks/useHandsFreeMode.ts` | Accept mode, route audio accordingly |
| `packages/native/modules/hands-free-media/src/HandsFreeMediaModule.ts` | Add `playSound`, `playAudioData` |
| `packages/native/modules/hands-free-media/ios/HandsFreeMediaModule.swift` | Implement `playSound`, `playAudioData` |
| `packages/native/assets/completion.wav` (or .mp3) | **New** — notification chime |
| `packages/server/src/voice-prompt.ts` | **New** — routing + TTS logic |
| `packages/server/src/app.ts` | Add `/voice-prompt` endpoint |

---

## Open Questions / Notes

- **Gemini TTS model**: As of early 2026, `gemini-2.5-flash-preview-tts` is available. Check if `@tanstack/ai-gemini` supports TTS or if we need to call the Gemini REST API directly.
- **TTS audio format**: Gemini TTS returns PCM/WAV. We'll need to verify the exact format and ensure AVAudioPlayer can handle it.
- **Completion sound file**: We need to bundle a short (~0.5s) chime. Can source a royalty-free one or generate it.
- **The "VOICE MODE" section in settings**: After removing the auto-record switch, we'll still keep the "Notification sound" setting. The section header stays.
