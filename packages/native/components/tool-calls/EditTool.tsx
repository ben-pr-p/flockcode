import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { ToolCallProps } from './types';

interface EditInput {
  filePath: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

interface WriteInput {
  filePath: string;
  content: string;
}

interface PatchInput {
  patchText: string;
}

function EditToolCollapsed({ description, toolName, toolMeta }: ToolCallProps) {
  const editInput = toolMeta.input as EditInput | undefined;
  const writeInput = toolMeta.input as WriteInput | undefined;
  const patchInput = toolMeta.input as PatchInput | undefined;

  let displayText = description;
  if (toolName === 'write' && writeInput?.filePath) {
    displayText = writeInput.filePath;
  } else if (toolName === 'apply_patch' && patchInput?.patchText) {
    const lines = patchInput.patchText.split('\n');
    const fileCount = lines.filter((l) => l.startsWith('--- ') || l.startsWith('+++ ')).length / 2;
    displayText = `${Math.max(1, Math.floor(fileCount))} file${fileCount !== 1 ? 's' : ''} updated`;
  } else if (editInput?.filePath) {
    displayText = editInput.filePath;
  }

  return (
    <Text
      className="text-[13px] font-medium text-amber-600 dark:text-amber-500"
      style={{ fontFamily: 'JetBrains Mono' }}
      numberOfLines={1}>
      {displayText}
    </Text>
  );
}

function EditToolExpanded({ toolName, toolMeta }: ToolCallProps) {
  const editInput = toolMeta.input as EditInput | undefined;
  const writeInput = toolMeta.input as WriteInput | undefined;
  const patchInput = toolMeta.input as PatchInput | undefined;
  const output = toolMeta.output || '';
  const error = toolMeta.error;

  if (toolName === 'write') {
    return (
      <View className="gap-3">
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            File Path
          </Text>
          <Text
            className="text-[12px] text-stone-700 dark:text-stone-300"
            style={{ fontFamily: 'JetBrains Mono' }}>
            {writeInput?.filePath || 'Unknown file'}
          </Text>
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

        {writeInput?.content && !error && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Content Preview
            </Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              <Text
                className="text-[12px] text-stone-600 dark:text-stone-400"
                style={{ fontFamily: 'JetBrains Mono' }}>
                {writeInput.content.split('\n').slice(0, 30).join('\n')}
                {writeInput.content.split('\n').length > 30 && '\n...'}
              </Text>
            </ScrollView>
          </View>
        )}

        {output && !error && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Result
            </Text>
            <Text
              className="text-[12px] text-stone-500 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {output}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (toolName === 'apply_patch') {
    return (
      <View className="gap-3">
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
              Result
            </Text>
            <Text
              className="text-[12px] text-green-600 dark:text-green-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {output}
            </Text>
          </View>
        )}

        {patchInput?.patchText && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Patch
            </Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              <Text
                className="text-[12px] text-stone-600 dark:text-stone-400"
                style={{ fontFamily: 'JetBrains Mono' }}>
                {patchInput.patchText}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text
          className="text-[10px] font-semibold uppercase text-stone-400"
          style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
          File Path
        </Text>
        <Text
          className="text-[12px] text-stone-700 dark:text-stone-300"
          style={{ fontFamily: 'JetBrains Mono' }}>
          {editInput?.filePath || 'Unknown file'}
        </Text>
      </View>

      {editInput?.replaceAll && (
        <View className="self-start rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-900/20">
          <Text
            className="text-[10px] text-amber-700 dark:text-amber-400"
            style={{ fontFamily: 'JetBrains Mono' }}>
            Replace All
          </Text>
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

      {editInput && 'oldString' in editInput && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-red-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Old String
          </Text>
          <ScrollView
            className="rounded-md bg-red-50 dark:bg-red-900/20"
            style={{ maxHeight: 120 }}
            nestedScrollEnabled>
            <View className="p-2">
              <Text
                className="text-[12px] text-red-700 dark:text-red-400"
                style={{ fontFamily: 'JetBrains Mono' }}>
                {editInput.oldString || '(empty)'}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {editInput && 'newString' in editInput && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-green-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            New String
          </Text>
          <ScrollView
            className="rounded-md bg-green-50 dark:bg-green-900/20"
            style={{ maxHeight: 120 }}
            nestedScrollEnabled>
            <View className="p-2">
              <Text
                className="text-[12px] text-green-700 dark:text-green-400"
                style={{ fontFamily: 'JetBrains Mono' }}>
                {editInput.newString || '(empty — deletion)'}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {output && !error && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Result
          </Text>
          <Text
            className="text-[12px] text-stone-500 dark:text-stone-400"
            style={{ fontFamily: 'JetBrains Mono' }}>
            {output}
          </Text>
        </View>
      )}
    </View>
  );
}

export { EditToolCollapsed, EditToolExpanded };
