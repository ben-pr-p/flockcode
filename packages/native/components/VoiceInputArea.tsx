import React, { useRef, useState, useCallback } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColorScheme } from 'nativewind'
import { Mic, Plus, ChevronDown } from 'lucide-react-native'
import type { RecordingState } from '../hooks/useAudioRecorder'

interface VoiceInputAreaProps {
  textValue: string
  onTextChange: (text: string) => void
  onSend: () => void
  isSending?: boolean
  onMicPressIn: () => void
  onMicPressOut: () => void
  onAttachPress: () => void
  onStopPress: () => void
  recordingState: RecordingState
  modelName: string
  providerName: string
}

export function VoiceInputArea({
  textValue,
  onTextChange,
  onSend,
  isSending,
  onMicPressIn,
  onMicPressOut,
  onAttachPress,
  onStopPress,
  recordingState,
  modelName,
  providerName,
}: VoiceInputAreaProps) {
  const insets = useSafeAreaInsets()
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === 'dark'
  const placeholderColor = isDark ? '#57534E' : '#A8A29E'
  const inputIconColor = isDark ? '#57534E' : '#A8A29E'
  const micIconColor = isDark ? '#0C0A09' : '#FAFAF9'
  const selectorColor = isDark ? '#57534E' : '#A8A29E'

  // Tap: starts recording, locked on — tap again to stop.
  // Hold (>300ms): starts recording — release to stop.
  const pressInTimeRef = useRef(0)
  const [locked, setLocked] = useState(false)

  const handlePressIn = useCallback(() => {
    if (recordingState === 'recording' && locked) {
      // Tap to stop locked recording
      setLocked(false)
      onMicPressOut()
      return
    }

    pressInTimeRef.current = Date.now()
    onMicPressIn()
  }, [recordingState, locked, onMicPressIn, onMicPressOut])

  const handlePressOut = useCallback(() => {
    if (recordingState !== 'recording') return

    const holdDuration = Date.now() - pressInTimeRef.current
    if (holdDuration < 300) {
      // Quick tap — lock recording on, user will tap again to stop
      setLocked(true)
      return
    }

    // Long hold — release to stop
    onMicPressOut()
  }, [recordingState, onMicPressOut])

  return (
    <View style={{ paddingBottom: insets.bottom + 4 }}>
      {/* Text input row — plus and stop buttons inside */}
      <View className="px-4 mb-3">
        <View className="flex-row items-end bg-stone-100 dark:bg-stone-900 rounded-xl pl-3.5 pr-1.5 py-1.5 gap-2" style={{ minHeight: 44 }}>
          <TextInput
            value={textValue}
            onChangeText={onTextChange}
            multiline
            scrollEnabled
            editable={!isSending}
            placeholder={isSending ? 'Waiting for response...' : 'Ask anything...'}
            placeholderTextColor={placeholderColor}
            className="flex-1 text-sm text-stone-900 dark:text-stone-50 py-1.5"
            style={{ fontFamily: 'JetBrains Mono', maxHeight: 120 }}

          />
          <View className="flex-row items-center gap-1 pb-0.5">
            <Pressable
              onPress={onAttachPress}
              className="w-[30px] h-[30px] rounded-lg bg-stone-50 dark:bg-stone-950 items-center justify-center"
            >
              <Plus size={16} color={inputIconColor} />
            </Pressable>
            <Pressable
              onPress={isSending ? onStopPress : onSend}
              className="w-[34px] h-[34px] rounded-lg bg-stone-900 dark:bg-stone-50 items-center justify-center"
              style={{ opacity: !textValue.trim() && !isSending ? 0.5 : 1 }}
            >
              {isSending ? (
                <View className="w-3 h-3 rounded-sm bg-stone-50 dark:bg-stone-950" />
              ) : (
                <Text className="text-stone-50 dark:text-stone-900 text-xs font-bold">↑</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Voice control row */}
      <View className="flex-row items-center justify-between px-4 mb-2">
        <Pressable className="flex-row items-center gap-1">
          <Text className="text-[11px] font-medium" style={{ fontFamily: 'JetBrains Mono', color: selectorColor }}>
            {providerName}
          </Text>
          <ChevronDown size={12} color={selectorColor} />
        </Pressable>

        {/* Mic button — tap to lock record, hold to record */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className="w-[52px] h-[52px] rounded-full items-center justify-center"
          style={{
            backgroundColor: recordingState === 'recording' ? '#EF4444' : '#F59E0B',
          }}
        >
          {recordingState === 'recording' ? (
            <View className="w-5 h-5 rounded-sm bg-stone-50 dark:bg-stone-900" />
          ) : (
            <Mic size={22} color={micIconColor} />
          )}
        </Pressable>

        <Pressable className="flex-row items-center gap-1">
          <Text className="text-[11px] font-medium" style={{ fontFamily: 'JetBrains Mono', color: selectorColor }}>
            {modelName}
          </Text>
          <ChevronDown size={12} color={selectorColor} />
        </Pressable>
      </View>

      {/* Recording state hint */}
      {recordingState === 'recording' && (
        <Text
          className="text-center text-xs text-stone-500 dark:text-stone-400 mt-1 mb-1"
          style={{ fontFamily: 'JetBrains Mono' }}
        >
          {locked ? 'recording · tap to send' : 'recording · release to send'}
        </Text>
      )}
    </View>
  )
}
