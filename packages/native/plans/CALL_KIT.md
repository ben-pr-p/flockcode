# Hands-Free Recording via CallKit

## Problem Statement

We want users to start and stop voice recording using their Bluetooth headphone's play/pause button. The recorded audio is sent to an AI coding agent. The ideal UX is: press headphone button → start recording → press again → stop and send.

## Why This Is Hard (iOS Bluetooth Limitations)

### The A2DP vs HFP Problem

Bluetooth headphones operate in two mutually exclusive profiles:

- **A2DP** (Advanced Audio Distribution Profile) — for media playback. Headphone button events route through `MPRemoteCommandCenter` and your app can intercept them.
- **HFP** (Hands-Free Profile) — for phone calls. Headphone button events route directly to the system (CallKit / telephony). Your app **cannot** intercept them via any public API.

### What triggers the profile switch

The switch from A2DP → HFP happens whenever the **microphone is activated**. This is controlled by `AVAudioSession.Category`:

| Category | Mic enabled | Bluetooth profile | Headphone button accessible |
|---|---|---|---|
| `.playback` | No | A2DP | Yes, via `MPRemoteCommandCenter` |
| `.record` | Yes | HFP | No |
| `.playAndRecord` | Yes | HFP | No |

There is no category that enables both the microphone and A2DP button interception. Every category that activates the mic switches Bluetooth to HFP.

### What we tried

1. **`.playback` + `MPRemoteCommandCenter`** — Headphone button works perfectly. But we can't record because the mic isn't enabled.
2. **`.playAndRecord` + `MPRemoteCommandCenter`** — Mic works, but headphone button events never arrive. Commands go through HFP and iOS provides no API to receive HFP events.
3. **`.playback` for idle, `.playAndRecord` for recording** — First press works (start recording). Second press doesn't work because we've switched to HFP.

### Apple's official position

From Apple Developer Forums (an Apple engineer's response):
> "MPRemoteCommandCenter handles A2DP commands but phone calls go over HFP, not A2DP. The system doesn't have any API an app can use to receive HFP commands (and never has)."

### The one exception: CallKit

When the headphone button is pressed during HFP mode, it sends a "hang up" signal. This signal is handled by the system and routed to **CallKit**. If your app has an active CallKit call, pressing the headphone button ends that call, and your app is notified via `CXProviderDelegate.provider(_:perform:)` with a `CXEndCallAction`.

This is how phone calls and VoIP apps (Signal, WhatsApp, FaceTime) handle the headphone button during calls — they don't intercept the button directly; they get notified that the call ended.

## Proposed Solution: Fake CallKit Calls

### Architecture

Use CallKit to create a "fake" call session when the user wants to record. The flow:

1. **Idle state** — Audio session is `.playback`. App registers `MPRemoteCommandCenter` handlers. Headphone button events arrive via A2DP.
2. **User presses headphone button (first press)** — `MPRemoteCommandCenter` receives the event.
3. **App starts a CallKit "call"** — Report an outgoing call to `CXProvider`. iOS switches audio to `.playAndRecord` (CallKit manages the audio session). Bluetooth switches to HFP.
4. **App starts recording** — Use `AVAudioEngine` or `AVAudioRecorder` to capture mic input.
5. **User presses headphone button (second press)** — HFP sends "hang up" signal → system routes to CallKit → CallKit notifies your app via `CXEndCallAction`.
6. **App stops recording and sends** — In the `CXEndCallAction` handler, stop recording, encode audio, send to server.
7. **App ends the CallKit call and restores `.playback`** — Back to A2DP, ready for next press.

### Implementation Details

#### 1. CallKit Setup

Create a new Expo native module (or extend `HandsFreeMediaModule`) with CallKit integration.

```swift
import CallKit

class HandsFreeCallManager: NSObject, CXProviderDelegate {
    private let provider: CXProvider
    private let callController = CXCallController()
    private var activeCallUUID: UUID?
    
    override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        // Optionally set a custom ringtone of silence
        config.ringtoneSound = nil
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }
    
    func startCall() {
        let uuid = UUID()
        activeCallUUID = uuid
        let handle = CXHandle(type: .generic, value: "Recording")
        let action = CXStartCallAction(call: uuid, handle: handle)
        action.isVideo = false
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { error in
            if let error = error {
                // Handle error — notify JS side
            }
        }
    }
    
    func endCall() {
        guard let uuid = activeCallUUID else { return }
        let action = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { error in
            if let error = error {
                // Handle error
            }
        }
    }
    
    // MARK: - CXProviderDelegate
    
    // Called when the system (or headphone button) ends the call
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        activeCallUUID = nil
        // >>> THIS is where we stop recording and send <<<
        // Send event to JS: "recording should stop"
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        // Configure audio session for recording
        // >>> THIS is where we start recording <<<
        action.fulfill()
    }
    
    func providerDidReset(_ provider: CXProvider) {
        activeCallUUID = nil
        // Clean up any active recording
    }
}
```

#### 2. Audio Session Management

CallKit manages the audio session during calls. When a call starts:
- CallKit activates the audio session with `.playAndRecord`
- The `provider(_:didActivate:)` delegate method is called with the `AVAudioSession`
- Start recording in this callback

When the call ends:
- Stop recording
- Restore `.playback` category
- Re-register `MPRemoteCommandCenter` handlers
- Restart silent audio playback

```swift
func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    // Audio session is now active with .playAndRecord
    // Start recording here
    startAudioRecording()
}

func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    // Audio session deactivated
    // Restore .playback and silent audio for next headphone button press
    restorePlaybackSession()
}
```

#### 3. Integration with Existing Code

The existing `HandsFreeMediaModule` handles:
- Silent audio playback (`.playback` mode)
- `MPRemoteCommandCenter` registration
- Sending `onToggleRecording` events to JS

Extend or replace it to add CallKit flow:
- On first `onToggleRecording` event → start CallKit call + start recording
- On `CXEndCallAction` (headphone hang-up) → stop recording + send event to JS
- After call ends → restore playback session for next cycle

The JS hook (`useHandsFreeMode.ts`) currently toggles between start/stop recording. It would need to be updated to handle the CallKit lifecycle, but the interface to the rest of the app stays the same.

#### 4. What's Already Built

The current implementation in `modules/hands-free-media/` has:

- **`HandsFreeMediaModule.swift`** — Native Expo module with `activate()`, `deactivate()`, `restorePlaybackSession()`. Plays silent audio, registers `MPRemoteCommandCenter` handlers, sends `onToggleRecording` events. The `.playback` → headphone button → JS event flow is **working on a physical device**.
- **`HandsFreeMedia.podspec`** — CocoaPods spec for the module.
- **`expo-module.config.json`** — Expo autolinking config (uses `"apple"` platform key, must have a podspec for the resolve step to find it).
- **`src/HandsFreeMediaModule.ts`** — TS types for the native module. Uses `requireOptionalNativeModule` so the app doesn't crash if the module isn't in the binary.
- **`useHandsFreeMode.ts`** — React hook bridging native events to `startRecording`/`stopRecording` from `useAudioRecorder`.
- **`VoiceInputArea.tsx`** — Purple headphone icon toggle button, hands-free hint text.
- **`SessionContent.tsx`** → `SessionScreen.tsx` / `SplitLayout.tsx`** — Props threading for `isHandsFreeActive` and `onHandsFreeToggle`.
- **`state/settings.ts`** — `handsFreeActiveAtom` (Jotai atom for active state).
- **`app.json`** — `UIBackgroundModes: ["audio"]` and `expo-asset` plugin for `silence.mp3`.
- **`package.json`** — `expo.autolinking.nativeModulesDir: "./modules"` for local module discovery.
- **`assets/silence.mp3`** — 1-second silent audio file for claiming the audio session.

#### 5. What Needs to Change

1. **Add CallKit to `HandsFreeMediaModule.swift`** — Add `CXProvider`, `CXCallController`, and `CXProviderDelegate` implementation. The module should manage the full lifecycle: idle → playback (A2DP) → call (HFP + recording) → end call → back to playback.

2. **New events to JS** — Instead of just `onToggleRecording`, the module should emit:
   - `onRecordingStarted` — CallKit call started, mic is active, start capturing
   - `onRecordingStopped` — headphone button ended the call, stop capturing and send
   - Or keep it simple with `onToggleRecording` and let JS track state

3. **Recording implementation** — Currently `expo-av` handles recording via `Audio.Recording.createAsync()`. This calls `Audio.setAudioModeAsync({ allowsRecordingIOS: true })` which reconfigures the audio session. With CallKit, the audio session is managed by CallKit, so we may need to:
   - Use `AVAudioEngine` on the native side for recording (bypassing expo-av's session management)
   - Or carefully call expo-av after CallKit has activated the session, hoping it doesn't reconfigure it
   - The safer approach is native recording via `AVAudioEngine` in the Swift module, returning base64 audio data to JS when done

4. **Update `useHandsFreeMode.ts`** — Handle the new event flow. The hook's `startRecording` / `stopRecording` calls might need to go through the native module instead of directly calling `useAudioRecorder` methods when in hands-free mode.

5. **Info.plist / capabilities** — CallKit requires the `voip` background mode in `UIBackgroundModes`. Add to `app.json`:
   ```json
   "UIBackgroundModes": ["audio", "voip"]
   ```
   You also need the `com.apple.developer.pushkit.voip` entitlement for incoming calls, but since we're only making outgoing "calls," this may not be needed.

### App Store Review Risks

**This is the biggest unknown.** Apple's App Store Review Guidelines (Section 2.4.1) state:

> "Apps should not use CallKit or be marketed as a calling app unless they actually make or receive phone calls or VoIP calls."

Mitigations:
- Frame it as a "voice channel" or "push-to-talk" feature, not a fake call
- The app genuinely transmits voice audio to a server (the AI agent), so it's arguably a one-way VoIP communication
- Don't show it as a "call" in the UI — minimize the call UI appearance
- Some walkie-talkie and PTT apps use CallKit similarly

**Risk level: Medium.** It could pass review, or it could be rejected. If rejected, the fallback is the current `.playback`-only approach where headphone button starts recording and auto-stop-on-silence or screen tap stops it.

### Alternative: Auto-Stop on Silence

If CallKit is rejected or feels too hacky, the fallback approach:

1. Headphone button press → start recording (switch to `.playAndRecord`, lose button)
2. Voice activity detection monitors audio levels
3. After N seconds of silence (e.g., 2-3 seconds), auto-stop and send
4. Restore `.playback` → headphone button works again for next recording

This is simpler and has no App Store risk, but the UX is slightly worse (no explicit stop control, potential premature cutoff during pauses in speech).

### Testing Notes

- **Must test on a physical device** — Simulator doesn't support `MPRemoteCommandCenter`, Bluetooth, or CallKit audio.
- **Build to device:** `npx expo run:ios --device` (may need to open Xcode to fix provisioning, see Signing & Capabilities → Automatically manage signing).
- **Bluetooth headphones required** — The A2DP/HFP profile switching only applies to Bluetooth. Wired headphones don't have this issue but are increasingly rare.
- **Log viewing:** Swift `print()` and `os.log` don't reliably show up in Metro or `log stream`. The current module returns diagnostic info from `activate()` as a JSON object to JS, which is logged via `console.log` in Metro. Keep this pattern for debugging.
