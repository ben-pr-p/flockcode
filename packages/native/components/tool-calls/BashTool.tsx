import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { ToolCallProps } from './types';

interface BashInput {
  command: string;
  description?: string;
  workdir?: string;
  timeout?: number;
}

function BashToolCollapsed({ description, toolMeta }: ToolCallProps) {
  const input = toolMeta.input as BashInput | undefined;
  const displayText = description || input?.command || 'Shell command';
  return (
    <Text
      className="text-[13px] font-medium text-amber-600 dark:text-amber-500"
      style={{ fontFamily: 'JetBrains Mono' }}
      numberOfLines={1}>
      {displayText}
    </Text>
  );
}

function BashToolExpanded({ toolMeta }: ToolCallProps) {
  const input = toolMeta.input as BashInput | undefined;
  const command = input?.command || '';
  const workdir = input?.workdir;
  const output = toolMeta.output || '';
  const error = toolMeta.error;

  return (
    <View className="gap-3">
      {workdir && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Working Directory
          </Text>
          <Text
            className="text-[12px] text-stone-500 dark:text-stone-400"
            style={{ fontFamily: 'JetBrains Mono' }}>
            {workdir}
          </Text>
        </View>
      )}

      <View className="gap-1">
        <Text
          className="text-[10px] font-semibold uppercase text-stone-400"
          style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
          Command
        </Text>
        <Text
          className="text-[12px] text-stone-700 dark:text-stone-300"
          style={{ fontFamily: 'JetBrains Mono' }}>
          {command}
        </Text>
      </View>

      {output && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Output
          </Text>
          <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
            <Text
              className="text-[12px] text-stone-600 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {output}
            </Text>
          </ScrollView>
        </View>
      )}

      {error && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-red-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Error
          </Text>
          <View className="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
            <Text
              className="text-[12px] text-red-600 dark:text-red-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {error}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export { BashToolCollapsed, BashToolExpanded };
