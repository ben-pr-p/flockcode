import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import type { ChangedFile } from '../hooks/useChanges'
import { DiffWebView } from './DiffWebView'

interface ChangesViewProps {
  sessionId: string
  changes: ChangedFile[]
}

const STATUS_LABEL: Record<ChangedFile['status'], string> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
}

const STATUS_COLOR: Record<ChangedFile['status'], string> = {
  added: 'text-oc-green',
  deleted: 'text-oc-red',
  modified: 'text-oc-accent',
}

function FileRow({ file, isExpanded, onPress }: {
  file: ChangedFile
  isExpanded: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3"
    >
      <Text
        className="text-xs text-oc-text-muted"
        style={{ fontFamily: 'JetBrains Mono', width: 10 }}
      >
        {isExpanded ? '\u25BC' : '\u25B6'}
      </Text>
      <Text
        className={`text-xs font-bold ${STATUS_COLOR[file.status]}`}
        style={{ fontFamily: 'JetBrains Mono', width: 14 }}
      >
        {STATUS_LABEL[file.status]}
      </Text>
      <Text
        className="text-xs text-oc-text-primary flex-1"
        style={{ fontFamily: 'JetBrains Mono' }}
        numberOfLines={1}
      >
        {file.path}
      </Text>
      <View className="flex-row items-center gap-2">
        {file.added > 0 && (
          <Text
            className="text-xs text-oc-green"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            +{file.added}
          </Text>
        )}
        {file.removed > 0 && (
          <Text
            className="text-xs text-oc-red"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            -{file.removed}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

export function ChangesView({ sessionId, changes }: ChangesViewProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  const toggleFile = (path: string) => {
    setExpandedFile((prev) => (prev === path ? null : path))
  }

  const expandedChange = expandedFile ? changes.find((f) => f.path === expandedFile) : null

  // When a file is expanded, pin its header and show the diff filling remaining space
  if (expandedChange) {
    return (
      <View className="flex-1">
        {/* Sticky file header */}
        <View className="px-4 py-3 border-b border-oc-divider">
          <FileRow
            file={expandedChange}
            isExpanded
            onPress={() => toggleFile(expandedChange.path)}
          />
        </View>
        {/* Diff fills remaining space, scrolls internally */}
        <View className="flex-1">
          <DiffWebView sessionId={sessionId} file={expandedChange.path} scrollable />
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-xs text-oc-text-muted" style={{ fontFamily: 'JetBrains Mono' }}>
        {changes.length} file{changes.length !== 1 ? 's' : ''} changed
      </Text>

      {changes.map((file) => (
        <FileRow
          key={file.path}
          file={file}
          isExpanded={false}
          onPress={() => toggleFile(file.path)}
        />
      ))}
    </ScrollView>
  )
}
