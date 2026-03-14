import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { ToolCallProps } from './types';

interface QuestionInput {
  questions: string;
}

function QuestionToolCollapsed({ description }: ToolCallProps) {
  return (
    <Text
      className="text-[13px] font-medium text-amber-600 dark:text-amber-500"
      style={{ fontFamily: 'JetBrains Mono' }}
      numberOfLines={1}>
      {description || 'Asked question'}
    </Text>
  );
}

function QuestionToolExpanded({ toolMeta }: ToolCallProps) {
  const input = toolMeta.input as QuestionInput | undefined;
  const output = toolMeta.output || '';
  const error = toolMeta.error;

  let questions: Array<{ name?: string; text: string }> = [];
  if (input?.questions) {
    try {
      const parsed = JSON.parse(input.questions);
      if (Array.isArray(parsed)) {
        questions = parsed;
      }
    } catch {
      // If parsing fails, treat as plain text
    }
  }

  return (
    <View className="gap-3">
      {questions.length > 0 && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Questions
          </Text>
          <View className="gap-2">
            {questions.map((q, idx) => (
              <View key={idx}>
                {q.name && (
                  <Text
                    className="mb-1 text-[10px] text-stone-400"
                    style={{ fontFamily: 'JetBrains Mono' }}>
                    {q.name}
                  </Text>
                )}
                <Text
                  className="text-[12px] text-stone-700 dark:text-stone-300"
                  style={{ fontFamily: 'JetBrains Mono' }}>
                  {typeof q === 'string' ? q : q.text || JSON.stringify(q)}
                </Text>
              </View>
            ))}
          </View>
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

      {output && !error && (
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Answer
          </Text>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            <Text
              className="text-[12px] text-stone-600 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {output}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export { QuestionToolCollapsed, QuestionToolExpanded };
