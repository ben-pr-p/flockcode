import React, { useState } from 'react'
import { View, Text, Pressable, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColorScheme } from 'nativewind'
import { Menu, FolderOpen, Settings, X, GitMerge, Check, CircleDot } from 'lucide-react-native'
import { SessionHeader } from './SessionHeader'
import { TabBar } from './TabBar'
import { ChatThread } from './ChatThread'
import { ChangesView } from './ChangesView'
import { VoiceInputArea } from './VoiceInputArea'
import { SettingsScreen } from './SettingsScreen'
import type { SessionValue, UIMessage as Message } from '../lib/stream-db'
import type { ChangedFile } from '../lib/stream-db'
import type { ConnectionInfo, NotificationSound } from '../__fixtures__/settings'
import type { LeftPanelContent } from '../state/ui'
import type { RecordingState } from '../hooks/useAudioRecorder'
import type { WorktreeStatusValue } from '../lib/stream-db'

interface SplitLayoutProps {
  sessionId: string
  session: SessionValue
  /** Pre-computed display name showing project dir (and worktree dir if different) */
  projectName: string
  messages: Message[]
  changes: ChangedFile[]
  onMenuPress: () => void
  onProjectsPress: () => void
  onToolCallPress?: (messageId: string) => void
  onSend: (text: string) => void
  isSending?: boolean
  audioRecorder: {
    recordingState: RecordingState
    startRecording: () => void
    stopRecording: () => void
    cancelRecording: () => void
  }
  onAbort?: () => void
  settings: {
    serverUrl: string
    setServerUrl: (url: string) => void
    connection: ConnectionInfo
    handsFreeAutoRecord: boolean
    setHandsFreeAutoRecord: (value: boolean) => void
    notificationSound: NotificationSound
    setNotificationSound: (value: NotificationSound) => void
    notificationSoundOptions: { label: string; value: NotificationSound }[]
    appVersion: string
    defaultModel: string
    onResyncConfig?: () => Promise<void>
  }
  modelName: string
  onModelPress?: () => void
  /** Worktree status for worktree sessions. */
  worktreeStatus?: WorktreeStatusValue
  /** Whether a merge operation is in progress. */
  isMerging?: boolean
  /** Callback to trigger a merge. */
  onMerge?: () => void
}

export function SplitLayout({
  sessionId,
  session,
  projectName,
  messages,
  changes,
  onMenuPress,
  onProjectsPress,
  onToolCallPress,
  onSend,
  isSending,
  audioRecorder,
  onAbort,
  settings,
  modelName,
  onModelPress,
  worktreeStatus,
  isMerging,
  onMerge,
}: SplitLayoutProps) {
  const insets = useSafeAreaInsets()
  const { colorScheme } = useColorScheme()
  const iconColor = colorScheme === 'dark' ? '#A8A29E' : '#44403C'
  const mutedIconColor = colorScheme === 'dark' ? '#57534E' : '#A8A29E'
  const [textValue, setTextValue] = useState('')
  const [leftPanel, setLeftPanel] = useState<LeftPanelContent>({ type: 'changes' })
  const [activeTab, setActiveTab] = useState<'session' | 'changes'>('session')
  const [settingsVisible, setSettingsVisible] = useState(false)

  const handleTabChange = (tab: 'session' | 'changes') => {
    setActiveTab(tab)
    if (tab === 'changes') {
      // On iPad, Changes tab navigates the left panel to diff view
      setLeftPanel({ type: 'changes' })
    }
  }

  const handleToolCallPress = (messageId: string) => {
    setLeftPanel({ type: 'tool-detail', messageId })
    onToolCallPress?.(messageId)
  }

  const handleSettingsPress = () => {
    setSettingsVisible(true)
  }

  const handleCloseSettings = () => {
    setSettingsVisible(false)
  }

  const handleCloseLeftPanel = () => {
    setLeftPanel({ type: 'changes' })
  }

  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950" style={{ paddingTop: insets.top }}>
      {/* Global header spanning full width */}
      <View className="h-12 flex-row items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800">
        <View className="flex-row items-center gap-3">
          <Pressable
            testID="menu-button"
            onPress={onMenuPress}
            className="w-9 h-9 items-center justify-center"
            hitSlop={8}
          >
            <Menu size={20} color={iconColor} />
          </Pressable>
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-green-500" />
            <Text
              className="text-sm font-semibold text-stone-900 dark:text-stone-50"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              {projectName}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            testID="settings-button"
            accessibilityLabel="Settings"
            onPress={handleSettingsPress}
            className="w-9 h-9 items-center justify-center"
            hitSlop={8}
          >
            <Settings size={20} color={iconColor} />
          </Pressable>
          <Pressable
            onPress={onProjectsPress}
            className="w-9 h-9 items-center justify-center"
            hitSlop={8}
          >
            <FolderOpen size={20} color={iconColor} />
          </Pressable>
        </View>
      </View>

      {/* Subheader bar with branch + merge/close buttons */}
      <View className="h-8 flex-row items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs text-stone-700 dark:text-stone-400">
            {session.title || 'Untitled'}
          </Text>
          <Text className="text-xs text-stone-400 dark:text-stone-600">·</Text>
          <Text className="text-xs text-stone-400 dark:text-stone-600">
            {formatRelativeTime(session.time.updated)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {worktreeStatus?.isWorktreeSession && !worktreeStatus.error && (
            <SplitWorktreeStatusBadge
              worktreeStatus={worktreeStatus}
              isMerging={!!isMerging}
              onMerge={onMerge}
            />
          )}
          {leftPanel.type !== 'changes' && (
            <Pressable
              onPress={handleCloseLeftPanel}
              className="w-7 h-7 items-center justify-center"
              hitSlop={8}
            >
              <X size={16} color={mutedIconColor} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Split pane content */}
      <View className="flex-1 flex-row">
        {/* Left panel — contextual content (~50%) */}
        <View className="flex-1 border-r border-stone-200 dark:border-stone-800">
          {leftPanel.type === 'tool-detail' ? (
            <View className="flex-1 p-4">
              <Text className="text-sm text-stone-400 dark:text-stone-600">
                Tool detail for message: {leftPanel.messageId}
              </Text>
            </View>
          ) : (
            <ChangesView sessionId={sessionId} changes={changes} />
          )}
        </View>

        {/* Right panel — always shows chat (~50%) */}
        <KeyboardAvoidingView
          className="flex-1"
          behavior="padding"
          keyboardVerticalOffset={insets.top + 48 + 32}
        >
          <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
          <ChatThread messages={messages} onToolCallPress={handleToolCallPress} />
          {!session.parentID && (
            <VoiceInputArea
              textValue={textValue}
              onTextChange={setTextValue}
              onSend={() => {
                const text = textValue.trim()
                if (!text) return
                setTextValue('')
                onSend(text)
              }}
              isSending={isSending}
              onMicPressIn={audioRecorder.startRecording}
              onMicPressOut={audioRecorder.stopRecording}
              onAttachPress={() => {}}
              onStopPress={audioRecorder.cancelRecording}
              recordingState={audioRecorder.recordingState}
              modelName={modelName}
              sessionStatus={session.status}
              onAbort={onAbort}
              onModelPress={onModelPress}
            />
          )}
        </KeyboardAvoidingView>
      </View>

      {/* Settings modal — centered overlay on iPad */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSettings}
      >
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          {/* Backdrop — dismiss on tap */}
          <Pressable className="absolute inset-0" onPress={handleCloseSettings} />

          {/* Modal card */}
          <View
            className="bg-stone-50 dark:bg-stone-950 rounded-2xl overflow-hidden"
            style={{
              width: 480,
              height: 560,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            <SettingsScreen
              serverUrl={settings.serverUrl}
              onServerUrlChange={settings.setServerUrl}
              connection={settings.connection}
              handsFreeAutoRecord={settings.handsFreeAutoRecord}
              onHandsFreeAutoRecordChange={settings.setHandsFreeAutoRecord}
              notificationSound={settings.notificationSound}
              onNotificationSoundChange={settings.setNotificationSound}
              notificationSoundOptions={settings.notificationSoundOptions}
              appVersion={settings.appVersion}
              defaultModel={settings.defaultModel}
              onDefaultModelPress={onModelPress}
              onResyncConfig={settings.onResyncConfig}
              onBack={handleCloseSettings}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

/** Compact worktree status badge for the SplitLayout subheader. */
function SplitWorktreeStatusBadge({
  worktreeStatus,
  isMerging,
  onMerge,
}: {
  worktreeStatus: WorktreeStatusValue
  isMerging: boolean
  onMerge?: () => void
}) {
  const { colorScheme } = useColorScheme()

  if (isMerging) {
    return (
      <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">
        <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#A8A29E' : '#44403C'} />
        <Text className="text-[10px] text-stone-500 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merging...
        </Text>
      </View>
    )
  }

  if (worktreeStatus.hasUncommittedChanges) {
    return (
      <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30">
        <CircleDot size={10} color={colorScheme === 'dark' ? '#fbbf24' : '#d97706'} />
        <Text className="text-[10px] text-amber-700 dark:text-amber-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Uncommitted
        </Text>
      </View>
    )
  }

  if (worktreeStatus.hasUnmergedCommits) {
    return (
      <Pressable
        onPress={onMerge}
        className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 active:opacity-70"
        hitSlop={4}
      >
        <GitMerge size={10} color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} />
        <Text className="text-[10px] text-blue-700 dark:text-blue-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merge
        </Text>
      </Pressable>
    )
  }

  if (worktreeStatus.merged) {
    return (
      <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30">
        <Check size={10} color={colorScheme === 'dark' ? '#4ade80' : '#16a34a'} />
        <Text className="text-[10px] text-green-700 dark:text-green-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merged
        </Text>
      </View>
    )
  }

  return null
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
