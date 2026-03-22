import { useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAtom, useSetAtom } from 'jotai'
import HandsFreeMedia from '../modules/hands-free-media'
import { handsFreeActiveAtom, nativeRecordingAtom } from '../state/settings'
import type { RecordingState } from './useAudioRecorder'

/** Whether the native module is available in this binary. */
const isModuleAvailable = HandsFreeMedia != null

/**
 * Bridges the native HandsFreeMedia module (with CallKit) to the app's
 * recording and audio-send flow.
 *
 * ## CallKit flow
 *
 * 1. Idle: audio session is `.playback`, headphone button events arrive via
 *    A2DP / `MPRemoteCommandCenter`.
 * 2. First headphone press: native module starts a CallKit "call", which
 *    switches Bluetooth to HFP and starts recording via `AVAudioEngine`.
 *    The hook receives `onRecordingStarted` and updates `recordingState`.
 * 3. Second headphone press (HFP hang-up): CallKit ends the call, native
 *    module stops recording and delivers base64 audio via `onRecordingStopped`.
 *    The hook calls `onSendAudio` with the audio data.
 * 4. The native module restores `.playback` automatically, ready for the
 *    next press.
 *
 * The `onToggleRecording` event is still handled as a fallback for cases
 * where CallKit is unavailable.
 */
export function useHandsFreeMode(
  recordingState: RecordingState,
  startRecording: () => void,
  stopRecording: () => void,
  onSendAudio?: (base64: string, mimeType: string) => void,
) {
  const [isActive, setIsActive] = useAtom(handsFreeActiveAtom)

  // Use refs so event listeners always see the latest values without
  // needing to re-subscribe.
  const recordingStateRef = useRef(recordingState)
  recordingStateRef.current = recordingState

  const startRecordingRef = useRef(startRecording)
  startRecordingRef.current = startRecording

  const stopRecordingRef = useRef(stopRecording)
  stopRecordingRef.current = stopRecording

  const onSendAudioRef = useRef(onSendAudio)
  onSendAudioRef.current = onSendAudio

  const setIsNativeRecording = useSetAtom(nativeRecordingAtom)

  // Subscribe to native events when active
  useEffect(() => {
    if (!isActive || !isModuleAvailable) return

    const subscriptions: { remove: () => void }[] = []

    // --- CallKit events (primary flow) ---

    // Native recording started (CallKit call active, AVAudioEngine running)
    subscriptions.push(
      HandsFreeMedia!.addListener('onRecordingStarted', () => {
        console.log('[HandsFree] onRecordingStarted — native recording active')
        setIsNativeRecording(true)
      }),
    )

    // Native recording stopped (CallKit call ended, audio delivered)
    subscriptions.push(
      HandsFreeMedia!.addListener('onRecordingStopped', (event) => {
        console.log(
          '[HandsFree] onRecordingStopped — audioData:',
          event?.audioData ? `${event.audioData.length} chars` : 'null',
          'duration:', event?.durationMs, 'ms',
        )
        setIsNativeRecording(false)

        if (event?.audioData && onSendAudioRef.current) {
          onSendAudioRef.current(event.audioData, event.mimeType)
        }
      }),
    )

    // --- Diagnostics (surfaces os.log messages to Metro) ---
    subscriptions.push(
      HandsFreeMedia!.addListener('onDiagnostic', (event) => {
        console.log('[HandsFree:native]', event?.message)
      }),
    )

    // --- Legacy fallback (no CallKit) ---
    subscriptions.push(
      HandsFreeMedia!.addListener('onToggleRecording', (event) => {
        console.log(
          '[HandsFree] onToggleRecording (fallback), source:',
          event?.source,
          'state:',
          recordingStateRef.current,
        )
        if (recordingStateRef.current === 'recording') {
          stopRecordingRef.current()
        } else {
          startRecordingRef.current()
        }
      }),
    )

    console.log('[HandsFree] subscribed to native events (CallKit + fallback)')

    return () => {
      subscriptions.forEach((s) => s.remove())
    }
  }, [isActive])

  const activate = useCallback(async () => {
    if (!isModuleAvailable) {
      Alert.alert(
        'Hands-Free Unavailable',
        'Native build required. Rebuild the app with "bun run ios".',
      )
      return
    }
    try {
      console.log('[HandsFree] calling native activate()')
      const result = await HandsFreeMedia!.activate()
      console.log('[HandsFree] native activate() result:', JSON.stringify(result))
      if (result.status === 'ok' || result.status === 'already_active') {
        setIsActive(true)
      } else {
        Alert.alert('Hands-Free Failed', result.error ?? 'Unknown error')
      }
    } catch (err: any) {
      console.error('[useHandsFreeMode] activate failed:', err)
      Alert.alert(
        'Hands-Free Failed',
        err.message ?? 'Could not activate hands-free mode.',
      )
    }
  }, [setIsActive])

  const deactivate = useCallback(async () => {
    if (!isModuleAvailable) return
    try {
      await HandsFreeMedia!.deactivate()
      setIsNativeRecording(false)
      setIsActive(false)
    } catch (err: any) {
      console.error('[useHandsFreeMode] deactivate failed:', err)
      setIsActive(false)
    }
  }, [setIsActive])

  const toggle = useCallback(async () => {
    if (isActive) {
      await deactivate()
    } else {
      await activate()
    }
  }, [isActive, activate, deactivate])

  // Clean up on unmount — deactivate if still active
  useEffect(() => {
    return () => {
      if (isActive && isModuleAvailable) {
        HandsFreeMedia!.deactivate().catch(() => {})
      }
    }
    // Only run on unmount, not when isActive changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isHandsFreeAvailable: isModuleAvailable,
    toggle,
    activate,
    deactivate,
  }
}
