import React from 'react';
import { View, Text, ScrollView, Linking, Pressable } from 'react-native';
import type { ToolCallProps } from './types';

interface WebFetchInput {
  url: string;
  format?: 'markdown' | 'text' | 'html';
}

interface WebSearchInput {
  query: string;
  numResults?: number;
}

interface CodeSearchInput {
  query: string;
  tokensNum?: number;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch {
    return url;
  }
}

function WebToolCollapsed({ description, toolName, toolMeta }: ToolCallProps) {
  const webfetchInput = toolMeta.input as WebFetchInput | undefined;
  const websearchInput = toolMeta.input as WebSearchInput | undefined;
  const codesearchInput = toolMeta.input as CodeSearchInput | undefined;

  let displayText = description;
  if (toolName === 'webfetch' && webfetchInput?.url) {
    displayText = extractDomain(webfetchInput.url);
  } else if (toolName === 'websearch' && websearchInput?.query) {
    displayText = websearchInput.query;
  } else if (toolName === 'codesearch' && codesearchInput?.query) {
    displayText = codesearchInput.query;
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

function WebToolExpanded({ toolName, toolMeta }: ToolCallProps) {
  const webfetchInput = toolMeta.input as WebFetchInput | undefined;
  const websearchInput = toolMeta.input as WebSearchInput | undefined;
  const codesearchInput = toolMeta.input as CodeSearchInput | undefined;
  const output = toolMeta.output || '';
  const error = toolMeta.error;

  const handleUrlPress = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (toolName === 'webfetch') {
    return (
      <View className="gap-3">
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            URL
          </Text>
          <Pressable onPress={() => webfetchInput?.url && handleUrlPress(webfetchInput.url)}>
            <Text
              className="text-[12px] text-blue-600 underline dark:text-blue-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {webfetchInput?.url || 'Unknown URL'}
            </Text>
          </Pressable>
        </View>

        {webfetchInput?.format && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Format
            </Text>
            <Text
              className="text-[12px] text-stone-500 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {webfetchInput.format}
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

        {output && !error && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Content
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
      </View>
    );
  }

  if (toolName === 'websearch' || toolName === 'codesearch') {
    const input = toolName === 'websearch' ? websearchInput : codesearchInput;
    const query = input?.query || '';

    return (
      <View className="gap-3">
        <View className="gap-1">
          <Text
            className="text-[10px] font-semibold uppercase text-stone-400"
            style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Query
          </Text>
          <Text
            className="text-[12px] text-stone-700 dark:text-stone-300"
            style={{ fontFamily: 'JetBrains Mono' }}>
            {query}
          </Text>
        </View>

        {websearchInput?.numResults && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Max Results
            </Text>
            <Text
              className="text-[12px] text-stone-500 dark:text-stone-400"
              style={{ fontFamily: 'JetBrains Mono' }}>
              {websearchInput.numResults}
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

        {output && !error && (
          <View className="gap-1">
            <Text
              className="text-[10px] font-semibold uppercase text-stone-400"
              style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
              Results
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
      </View>
    );
  }

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
    </View>
  );
}

export { WebToolCollapsed, WebToolExpanded };
