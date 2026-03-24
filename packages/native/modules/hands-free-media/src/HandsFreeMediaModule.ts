import { NativeModule, requireOptionalNativeModule } from 'expo'

/** Events emitted by the HandsFreeMedia native module. */
export type HandsFreeMediaEvents = {
  /** Legacy toggle event — only fired as fallback when CallKit is unavailable. */
  onToggleRecording: (params: { source: string }) => void
  /** CallKit call started, AVAudioEngine recording is active. */
  onRecordingStarted: (params: Record<string, never>) => void
  /**
   * CallKit call ended (headphone hang-up or programmatic).
   * If audioData is non-null, it contains base64-encoded audio (audio/x-caf).
   * Null audioData means the recording was too short or failed.
   */
  onRecordingStopped: (params: {
    audioData: string | null
    mimeType: string
    durationMs: number
  }) => void
  /** Diagnostic messages from the native side for debugging. */
  onDiagnostic: (params: { message: string }) => void
}

export type ActivateResult = {
  status: string
  error?: string
  log?: string[]
}

declare class HandsFreeMediaModuleClass extends NativeModule<HandsFreeMediaEvents> {
  /**
   * Activate hands-free mode: plays silent audio, registers MPRemoteCommandCenter
   * handlers for the headphone button (A2DP), and initializes CallKit for
   * recording via HFP.
   */
  activate(): Promise<ActivateResult>
  /** Restore .playback session after recording finishes, so remote commands work again. */
  restorePlaybackSession(): Promise<boolean>
  /** Deactivate hands-free mode: ends any active call, stops silent audio, unregisters remote commands, releases audio session. */
  deactivate(): Promise<boolean>
  /**
   * Play a bundled short audio file (e.g. "completion" chime) through the
   * current audio session. Works while the phone is locked.
   */
  playSound(soundName: string): Promise<boolean>
  /**
   * Play raw base64-encoded audio data (e.g. TTS response) through the current
   * audio session. Works while the phone is locked.
   */
  playAudioData(base64: string, mimeType: string): Promise<boolean>
}

export default requireOptionalNativeModule<HandsFreeMediaModuleClass>('HandsFreeMedia')
