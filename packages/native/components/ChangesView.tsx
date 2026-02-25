import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import type { ChangedFile } from '../hooks/useChanges'

interface ChangesViewProps {
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

export function ChangesView({ changes }: ChangesViewProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text className="text-xs text-oc-text-muted" style={{ fontFamily: 'JetBrains Mono' }}>
        {changes.length} file{changes.length !== 1 ? 's' : ''} changed
      </Text>

      {changes.map((file) => (
        <View key={file.path} className="flex-row items-center gap-3">
          {/* Status badge */}
          <Text
            className={`text-xs font-bold ${STATUS_COLOR[file.status]}`}
            style={{ fontFamily: 'JetBrains Mono', width: 14 }}
          >
            {STATUS_LABEL[file.status]}
          </Text>

          {/* File path */}
          <Text
            className="text-xs text-oc-text-primary flex-1"
            style={{ fontFamily: 'JetBrains Mono' }}
            numberOfLines={1}
          >
            {file.path}
          </Text>

          {/* Line counts */}
          <View className="flex-row items-center gap-2">
            {file.added > 0 && (
              <Text className="text-xs text-oc-green" style={{ fontFamily: 'JetBrains Mono' }}>
                +{file.added}
              </Text>
            )}
            {file.removed > 0 && (
              <Text className="text-xs text-oc-red" style={{ fontFamily: 'JetBrains Mono' }}>
                -{file.removed}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
