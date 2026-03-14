import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { ToolCallProps } from './types';

interface SkillInput {
  name: string;
}

function SkillToolCollapsed({ description, toolMeta }: ToolCallProps) {
  const input = toolMeta.input as SkillInput | undefined;
  const skillName = input?.name || description || 'Unknown skill';
  return (
    <Text
      className="text-[13px] font-medium text-amber-600 dark:text-amber-500"
      style={{ fontFamily: 'JetBrains Mono' }}
      numberOfLines={1}>
      {skillName}
    </Text>
  );
}

function SkillToolExpanded({ toolMeta }: ToolCallProps) {
  const input = toolMeta.input as SkillInput | undefined;
  const output = toolMeta.output || '';
  const error = toolMeta.error;
  const skillName = input?.name || 'Unknown skill';

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text
          className="text-[10px] font-semibold uppercase text-stone-400"
          style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
          Skill Name
        </Text>
        <View className="self-start rounded-md bg-blue-100 px-2 py-1 dark:bg-blue-900/30">
          <Text
            className="text-[12px] text-blue-700 dark:text-blue-400"
            style={{ fontFamily: 'JetBrains Mono' }}>
            {skillName}
          </Text>
        </View>
      </View>

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

      {output && !error && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Instructions
          </Text>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            <Text
              className="text-[12px] text-stone-600 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {output.slice(0, 500)}
              {output.length > 500 && '...'}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export { SkillToolCollapsed, SkillToolExpanded };
