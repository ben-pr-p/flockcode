import React from 'react'
import { View, Text, Pressable, Modal } from 'react-native'
import { useColorScheme } from 'nativewind'
import { Droplets, Footprints } from 'lucide-react-native'
import type { HandsFreeMode } from '../state/settings'

interface HandsFreeModePickerProps {
  visible: boolean
  onClose: () => void
  mode: HandsFreeMode
  onModeChange: (mode: HandsFreeMode) => void
}

/**
 * Simple centered modal to switch between hands-free modes.
 * Opened via long-press on the hands-free button in VoiceInputArea.
 */
export function HandsFreeModePicker({
  visible,
  onClose,
  mode,
  onModeChange,
}: HandsFreeModePickerProps) {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === 'dark'

  const handleSelect = (selected: HandsFreeMode) => {
    onModeChange(selected)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        {/* Backdrop dismiss */}
        <Pressable className="absolute inset-0" onPress={onClose} />

        {/* Modal card */}
        <View
          className="rounded-2xl bg-stone-50 dark:bg-stone-950 px-6 py-5"
          style={{
            width: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          <Text
            className="text-sm font-semibold text-stone-900 dark:text-stone-50 text-center mb-4"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            Hands-Free Mode
          </Text>

          <View className="flex-row gap-3">
            <ModeOption
              icon={Droplets}
              label="Washing Dishes"
              selected={mode === 'washing-dishes'}
              onPress={() => handleSelect('washing-dishes')}
              isDark={isDark}
            />
            <ModeOption
              icon={Footprints}
              label="Walking"
              selected={mode === 'walking'}
              onPress={() => handleSelect('walking')}
              isDark={isDark}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ModeOption({
  icon: Icon,
  label,
  selected,
  onPress,
  isDark,
}: {
  icon: typeof Droplets
  label: string
  selected: boolean
  onPress: () => void
  isDark: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center rounded-xl py-4 px-2"
      style={{
        backgroundColor: selected
          ? (isDark ? '#7C3AED' : '#8B5CF6')
          : (isDark ? '#1C1917' : '#F5F5F4'),
      }}
    >
      <Icon
        size={24}
        color={selected ? '#FAFAF9' : (isDark ? '#A8A29E' : '#57534E')}
      />
      <Text
        className="mt-2 text-[11px] font-medium text-center"
        style={{
          fontFamily: 'JetBrains Mono',
          color: selected ? '#FAFAF9' : (isDark ? '#A8A29E' : '#57534E'),
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
