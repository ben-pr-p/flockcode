import React from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Menu, FolderOpen, GitMerge, Check, CircleDot } from 'lucide-react-native'
import { useColorScheme } from 'nativewind'
import { useAtomValue } from 'jotai'
import { connectionInfoAtom } from '../state/settings'
import type { WorktreeStatusValue } from '../lib/stream-db'

interface SessionHeaderProps {
  projectName: string
  branchName: string | null
  relativeTime: string
  onMenuPress: () => void
  onProjectsPress: () => void
  /** Worktree status for worktree sessions. Omit for non-worktree sessions. */
  worktreeStatus?: WorktreeStatusValue
  /** Whether a merge operation is in progress. */
  isMerging?: boolean
  /** Callback to trigger a merge. */
  onMerge?: () => void
}

/** Session header with project name, session info, and optional worktree status. */
export function SessionHeader({
  projectName,
  branchName,
  relativeTime,
  onMenuPress,
  onProjectsPress,
  worktreeStatus,
  isMerging,
  onMerge,
}: SessionHeaderProps) {
  const { colorScheme } = useColorScheme()
  const iconColor = colorScheme === 'dark' ? '#A8A29E' : '#44403C'
  const connection = useAtomValue(connectionInfoAtom)
  const dotColor = connection.status === 'connected' ? 'bg-green-500' : 'bg-red-500'

  const isWorktree = worktreeStatus?.isWorktreeSession && !worktreeStatus.error

  return (
    <View>
      {/* Top header row */}
      <View className="h-12 flex-row items-center justify-between px-4">
        <Pressable
          testID="menu-button"
          onPress={onMenuPress}
          className="w-9 h-9 items-center justify-center"
          hitSlop={8}
        >
          <Menu size={20} color={iconColor} />
        </Pressable>

        <View className="flex-row items-center gap-2">
          <View className={`w-2 h-2 rounded-full ${dotColor}`} />
          <Text
            className="text-sm font-semibold text-stone-900 dark:text-stone-50"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {projectName}
          </Text>
        </View>

        <Pressable
          onPress={onProjectsPress}
          className="w-9 h-9 items-center justify-center"
          hitSlop={8}
        >
          <FolderOpen size={20} color={iconColor} />
        </Pressable>
      </View>

      {/* Session info bar */}
      {branchName && (
        <View className="px-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5 flex-shrink">
            <Text className="text-xs text-stone-700 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
              {branchName}
            </Text>
            <Text className="text-xs text-stone-400 dark:text-stone-600" style={{ fontFamily: 'JetBrains Mono' }}>·</Text>
            <Text className="text-xs text-stone-400 dark:text-stone-600" style={{ fontFamily: 'JetBrains Mono' }}>{relativeTime}</Text>
          </View>

          {isWorktree && (
            <WorktreeStatusBadge
              worktreeStatus={worktreeStatus!}
              isMerging={!!isMerging}
              onMerge={onMerge}
            />
          )}
        </View>
      )}
    </View>
  )
}

/**
 * Worktree status badge shown in the session info bar.
 *
 * Three states:
 * - **Uncommitted** (yellow) — worktree has staged/unstaged changes
 * - **Merge** (blue button) — no uncommitted changes, unmerged commits exist
 * - **Merged** (green) — everything is in main
 */
function WorktreeStatusBadge({
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
      <View className="flex-row items-center gap-1 px-2 py-1 rounded bg-stone-200 dark:bg-stone-800">
        <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#A8A29E' : '#44403C'} />
        <Text className="text-xs text-stone-500 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merging...
        </Text>
      </View>
    )
  }

  // Uncommitted changes take priority — can't merge until they're committed
  if (worktreeStatus.hasUncommittedChanges) {
    return (
      <View className="flex-row items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30">
        <CircleDot size={12} color={colorScheme === 'dark' ? '#fbbf24' : '#d97706'} />
        <Text className="text-xs text-amber-700 dark:text-amber-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Uncommitted
        </Text>
      </View>
    )
  }

  // Has unmerged commits — show merge button
  if (worktreeStatus.hasUnmergedCommits) {
    return (
      <Pressable
        onPress={onMerge}
        className="flex-row items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 active:opacity-70"
        hitSlop={4}
      >
        <GitMerge size={12} color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} />
        <Text className="text-xs text-blue-700 dark:text-blue-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merge
        </Text>
      </Pressable>
    )
  }

  // Fully merged — no uncommitted changes, no unmerged commits
  if (worktreeStatus.merged) {
    return (
      <View className="flex-row items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900/30">
        <Check size={12} color={colorScheme === 'dark' ? '#4ade80' : '#16a34a'} />
        <Text className="text-xs text-green-700 dark:text-green-400" style={{ fontFamily: 'JetBrains Mono' }}>
          Merged
        </Text>
      </View>
    )
  }

  // Worktree session with no changes yet (fresh worktree)
  return null
}
