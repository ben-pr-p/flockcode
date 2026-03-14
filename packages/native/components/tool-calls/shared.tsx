/**
 * Shared constants and components used across tool call renderers.
 */

import React from 'react'
import { View } from 'react-native'
import type { ToolCallStatus } from '../../server/src/types'

/** Human-readable labels for tool names. */
export const TOOL_LABELS: Record<string, string> = {
  bash: 'Shell',
  read: 'Read',
  edit: 'Edit',
  write: 'Write',
  apply_patch: 'Patch',
  multi_edit: 'Multi-Edit',
  grep: 'Grep',
  glob: 'Glob',
  list: 'List',
  task: 'Task',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  codesearch: 'CodeSearch',
  todowrite: 'Todos',
  question: 'Question',
  skill: 'Skill',
}

/** Status indicator dot color based on tool call lifecycle state. */
export function StatusDot({ status }: { status?: ToolCallStatus | string }) {
  switch (status) {
    case 'error':
      return <View className="w-3.5 h-3.5 rounded-sm bg-red-500" />
    case 'running':
      return <View className="w-3.5 h-3.5 rounded-sm bg-amber-500 opacity-75" />
    case 'completed':
      return <View className="w-3.5 h-3.5 rounded-sm bg-green-600 dark:bg-green-500" />
    case 'pending':
    default:
      return <View className="w-3.5 h-3.5 rounded-sm bg-stone-400 dark:bg-stone-600" />
  }
}

/** Format a duration in ms to a human-readable string. */
export function formatDuration(startMs: number, endMs?: number): string | null {
  if (!endMs) return null
  const durationMs = endMs - startMs
  if (durationMs < 1000) return `${durationMs}ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}
