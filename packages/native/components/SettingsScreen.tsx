import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, Switch, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColorScheme } from 'nativewind'
import { ArrowLeft, ChevronDown, Monitor, Cloud, Plus, Pencil, Trash2 } from 'lucide-react-native'
import type { ConnectionInfo, NotificationSound } from '../__fixtures__/settings'
import type { BackendConfig, BackendType, BackendConnection, BackendUrl } from '../state/backends'

interface SettingsScreenProps {
  backends: BackendConfig[]
  onBackendsChange: (backends: BackendConfig[]) => void
  connections: Record<string, BackendConnection>
  connection: ConnectionInfo
  handsFreeAutoRecord: boolean
  onHandsFreeAutoRecordChange: (value: boolean) => void
  notificationSound: NotificationSound
  onNotificationSoundChange: (value: NotificationSound) => void
  notificationSoundOptions: { label: string; value: NotificationSound }[]
  appVersion: string
  onBack: () => void
}

export function SettingsScreen({
  backends,
  onBackendsChange,
  connections,
  connection,
  handsFreeAutoRecord,
  onHandsFreeAutoRecordChange,
  notificationSound,
  onNotificationSoundChange,
  notificationSoundOptions,
  appVersion,
  onBack,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets()
  const { colorScheme, setColorScheme } = useColorScheme()
  const iconColor = colorScheme === 'dark' ? '#A8A29E' : '#44403C'
  const mutedIconColor = colorScheme === 'dark' ? '#57534E' : '#A8A29E'
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAddBackend = useCallback(() => {
    const newBackend: BackendConfig = {
      url: '' as BackendUrl,
      name: '',
      type: 'sprite',
      enabled: true,
    }
    onBackendsChange([...backends, newBackend])
    setEditingIndex(backends.length)
  }, [backends, onBackendsChange])

  const handleUpdateBackend = useCallback((index: number, updates: Partial<BackendConfig>) => {
    const updated = backends.map((b, i) => (i === index ? { ...b, ...updates } : b))
    onBackendsChange(updated)
  }, [backends, onBackendsChange])

  const handleDeleteBackend = useCallback((index: number) => {
    Alert.alert(
      'Delete Server',
      `Remove "${backends[index].name || backends[index].url}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onBackendsChange(backends.filter((_, i) => i !== index))
            if (editingIndex === index) setEditingIndex(null)
          },
        },
      ],
    )
  }, [backends, onBackendsChange, editingIndex])

  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-5 gap-4">
        <Pressable
          testID="settings-back"
          onPress={onBack}
          className="w-10 h-10 rounded-lg bg-white dark:bg-stone-900 items-center justify-center"
        >
          <ArrowLeft size={20} color={iconColor} />
        </Pressable>
        <Text className="text-lg font-semibold text-stone-900 dark:text-stone-50" style={{ fontFamily: 'JetBrains Mono' }}>Settings</Text>
      </View>

      {/* Divider */}
      <View className="h-px bg-stone-200 dark:bg-stone-800" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) }}
      >
        {/* SERVERS section */}
        <SectionHeader title="SERVERS" />

        <View className="px-5 gap-3">
          {backends.map((backend, index) => (
            <BackendEntry
              key={`${backend.url}-${index}`}
              backend={backend}
              connection={connections[backend.url]}
              isEditing={editingIndex === index}
              onEdit={() => setEditingIndex(editingIndex === index ? null : index)}
              onUpdate={(updates) => handleUpdateBackend(index, updates)}
              onDelete={() => handleDeleteBackend(index)}
            />
          ))}

          <Pressable
            onPress={handleAddBackend}
            className="flex-row items-center justify-center gap-2 bg-white dark:bg-stone-900 rounded-lg h-10"
          >
            <Plus size={16} color={iconColor} />
            <Text
              className="text-xs font-medium text-stone-700 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              Add Server
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View className="h-px bg-stone-200 dark:bg-stone-800 mx-5 mt-4" />

        {/* APPEARANCE section */}
        <SectionHeader title="APPEARANCE" />

        <View className="px-5 pb-1">
          <Text className="text-sm font-medium text-stone-900 dark:text-stone-50 mb-3" style={{ fontFamily: 'JetBrains Mono' }}>Theme</Text>
          <View className="flex-row gap-2">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setColorScheme(mode)}
                className={`flex-1 h-10 rounded-lg items-center justify-center ${
                  (mode === 'system' && colorScheme === undefined) ||
                  (mode === 'light' && colorScheme === 'light') ||
                  (mode === 'dark' && colorScheme === 'dark')
                    ? 'bg-amber-500'
                    : 'bg-white dark:bg-stone-900'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    (mode === 'system' && colorScheme === undefined) ||
                    (mode === 'light' && colorScheme === 'light') ||
                    (mode === 'dark' && colorScheme === 'dark')
                      ? 'text-stone-950'
                      : 'text-stone-700 dark:text-stone-400'
                  }`}
                  style={{ fontFamily: 'JetBrains Mono' }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-stone-200 dark:bg-stone-800 mx-5 mt-4" />

        {/* VOICE MODE section */}
        <SectionHeader title="VOICE MODE" />

        <SettingsRow
          label="Hands-free auto-record"
          description="Auto-record when agent finishes"
        >
          <Switch
            testID="auto-record-toggle"
            value={handsFreeAutoRecord}
            onValueChange={onHandsFreeAutoRecordChange}
            trackColor={{ false: colorScheme === 'dark' ? '#292524' : '#E7E5E4', true: '#F59E0B' }}
            thumbColor="#FFFFFF"
          />
        </SettingsRow>

        <AutoRecordBehavior />

        <SettingsRow label="Notification sound">
          <DropdownPicker
            value={notificationSound}
            options={notificationSoundOptions}
            onValueChange={onNotificationSoundChange}
          />
        </SettingsRow>

        {/* Divider */}
        <View className="h-px bg-stone-200 dark:bg-stone-800 mx-5 mt-2" />

        {/* ABOUT section */}
        <SectionHeader title="ABOUT" />

        <View className="px-5 py-3.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-stone-900 dark:text-stone-50" style={{ fontFamily: 'JetBrains Mono' }}>Version</Text>
            <Text
              className="text-xs text-stone-700 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              {appVersion}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

// --- Backend Entry ---

interface BackendEntryProps {
  backend: BackendConfig
  connection: BackendConnection | undefined
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<BackendConfig>) => void
  onDelete: () => void
}

function BackendEntry({ backend, connection, isEditing, onEdit, onUpdate, onDelete }: BackendEntryProps) {
  const { colorScheme } = useColorScheme()
  const iconColor = colorScheme === 'dark' ? '#A8A29E' : '#44403C'
  const mutedIconColor = colorScheme === 'dark' ? '#57534E' : '#A8A29E'
  const placeholderColor = colorScheme === 'dark' ? '#57534E' : '#A8A29E'
  const TypeIcon = backend.type === 'local' ? Monitor : Cloud

  const statusDot = connection?.status === 'connected'
    ? 'bg-green-500'
    : connection?.status === 'reconnecting'
      ? 'bg-amber-500'
      : connection?.status === 'error'
        ? 'bg-red-500'
        : 'bg-stone-400 dark:bg-stone-600'

  const statusLabel = connection?.status === 'connected'
    ? `Connected · ${connection.latencyMs}ms`
    : connection?.status === 'reconnecting'
      ? 'Connecting...'
      : connection?.status === 'error'
        ? connection.error ?? 'Connection failed'
        : 'Offline'

  return (
    <View className="bg-white dark:bg-stone-900 rounded-lg overflow-hidden">
      {/* Summary row */}
      <View className="px-3.5 py-3 flex-row items-center gap-3">
        <TypeIcon size={18} color={iconColor} />
        <View className="flex-1 gap-0.5">
          <Text
            className="text-sm font-medium text-stone-900 dark:text-stone-50"
            style={{ fontFamily: 'JetBrains Mono' }}
            numberOfLines={1}
          >
            {backend.name || 'Unnamed'}
          </Text>
          <Text
            className="text-[11px] text-stone-400 dark:text-stone-600"
            style={{ fontFamily: 'JetBrains Mono' }}
            numberOfLines={1}
          >
            {backend.url || 'No URL set'}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <Text
              className="text-[10px] text-stone-500 dark:text-stone-500"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
        <Pressable onPress={onEdit} hitSlop={8}>
          <Pencil size={16} color={mutedIconColor} />
        </Pressable>
      </View>

      {/* Edit form (shown when editing) */}
      {isEditing && (
        <View className="px-3.5 pb-3 gap-2.5 border-t border-stone-100 dark:border-stone-800 pt-2.5">
          <View>
            <Text className="text-[10px] text-stone-400 dark:text-stone-600 mb-1" style={{ fontFamily: 'JetBrains Mono' }}>
              Name
            </Text>
            <TextInput
              value={backend.name}
              onChangeText={(name) => onUpdate({ name })}
              placeholder="My MacBook"
              placeholderTextColor={placeholderColor}
              className="bg-stone-50 dark:bg-stone-950 rounded h-9 px-2.5 text-xs text-stone-900 dark:text-stone-50"
              style={{ fontFamily: 'JetBrains Mono' }}
            />
          </View>
          <View>
            <Text className="text-[10px] text-stone-400 dark:text-stone-600 mb-1" style={{ fontFamily: 'JetBrains Mono' }}>
              URL
            </Text>
            <TextInput
              value={backend.url}
              onChangeText={(url) => onUpdate({ url: url as BackendUrl })}
              placeholder="http://localhost:3000"
              placeholderTextColor={placeholderColor}
              className="bg-stone-50 dark:bg-stone-950 rounded h-9 px-2.5 text-xs text-stone-900 dark:text-stone-50"
              style={{ fontFamily: 'JetBrains Mono' }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <View>
            <Text className="text-[10px] text-stone-400 dark:text-stone-600 mb-1" style={{ fontFamily: 'JetBrains Mono' }}>
              Type
            </Text>
            <View className="flex-row gap-2">
              {(['local', 'sprite'] as BackendType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onUpdate({ type: t })}
                  className={`flex-1 h-8 rounded items-center justify-center ${
                    backend.type === t
                      ? 'bg-amber-500'
                      : 'bg-stone-50 dark:bg-stone-950'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-medium ${
                      backend.type === t
                        ? 'text-stone-950'
                        : 'text-stone-600 dark:text-stone-500'
                    }`}
                    style={{ fontFamily: 'JetBrains Mono' }}
                  >
                    {t === 'local' ? 'Local' : 'Sprite'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {backend.type === 'sprite' && (
            <View>
              <Text className="text-[10px] text-stone-400 dark:text-stone-600 mb-1" style={{ fontFamily: 'JetBrains Mono' }}>
                Auth Token
              </Text>
              <TextInput
                value={backend.authToken ?? ''}
                onChangeText={(authToken) => onUpdate({ authToken: authToken || undefined })}
                placeholder="Bearer token (optional)"
                placeholderTextColor={placeholderColor}
                className="bg-stone-50 dark:bg-stone-950 rounded h-9 px-2.5 text-xs text-stone-900 dark:text-stone-50"
                style={{ fontFamily: 'JetBrains Mono' }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>
          )}
          <View className="flex-row items-center justify-between pt-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-[11px] text-stone-500 dark:text-stone-500" style={{ fontFamily: 'JetBrains Mono' }}>
                Enabled
              </Text>
              <Switch
                value={backend.enabled}
                onValueChange={(enabled) => onUpdate({ enabled })}
                trackColor={{
                  false: colorScheme === 'dark' ? '#292524' : '#E7E5E4',
                  true: '#F59E0B',
                }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scale: 0.8 }] }}
              />
            </View>
            <Pressable
              onPress={onDelete}
              className="flex-row items-center gap-1"
              hitSlop={8}
            >
              <Trash2 size={14} color="#ef4444" />
              <Text className="text-[11px] text-red-500" style={{ fontFamily: 'JetBrains Mono' }}>
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

// --- Sub-components ---

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-5 pt-6 pb-2">
      <Text
        className="text-[10px] font-semibold text-stone-400 dark:text-stone-600"
        style={{ letterSpacing: 2, fontFamily: 'JetBrains Mono' }}
      >
        {title}
      </Text>
    </View>
  )
}

interface SettingsRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <View className="px-5 py-3.5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-stone-900 dark:text-stone-50" style={{ fontFamily: 'JetBrains Mono' }}>{label}</Text>
          {description && (
            <Text className="text-xs text-stone-400 dark:text-stone-600 mt-0.5">{description}</Text>
          )}
        </View>
        {children}
      </View>
    </View>
  )
}

interface DropdownPickerProps<T extends string | number> {
  value: T
  options: { label: string; value: T }[]
  onValueChange: (value: T) => void
}

function DropdownPicker<T extends string | number>({
  value,
  options,
  onValueChange,
}: DropdownPickerProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const { colorScheme } = useColorScheme()
  const chevronColor = colorScheme === 'dark' ? '#78716C' : '#78716C'
  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  return (
    <View>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        className="flex-row items-center gap-1.5 bg-white dark:bg-stone-900 rounded-lg px-3 py-2"
      >
        <Text className="text-xs text-stone-700 dark:text-stone-400">{selectedLabel}</Text>
        <ChevronDown size={14} color={chevronColor} />
      </Pressable>

      {isOpen && (
        <View className="absolute top-11 right-0 bg-white dark:bg-stone-900 rounded-lg overflow-hidden z-10 min-w-[160px]"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {options.map((option) => (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                onValueChange(option.value)
                setIsOpen(false)
              }}
              className={`px-3.5 py-2.5 ${
                option.value === value ? 'bg-stone-100 dark:bg-stone-950' : ''
              }`}
            >
              <Text
                className={`text-xs ${
                  option.value === value ? 'text-amber-600 dark:text-amber-500' : 'text-stone-700 dark:text-stone-400'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

// --- Auto-record behavior summary ---

function AutoRecordBehavior() {
  return (
    <View className="px-5 pb-2">
      <View className="bg-white dark:bg-stone-900 rounded-lg px-3.5 py-3 gap-2">
        <BehaviorItem text="Pauses system audio when agent finishes responding" />
        <BehaviorItem text="Plays a beep to notify you" />
        <BehaviorItem text="Automatically starts recording your response" />
      </View>
    </View>
  )
}

function BehaviorItem({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Text className="text-xs text-stone-400 dark:text-stone-600 mt-0.5">•</Text>
      <Text className="text-xs text-stone-700 dark:text-stone-400 flex-1">{text}</Text>
    </View>
  )
}
