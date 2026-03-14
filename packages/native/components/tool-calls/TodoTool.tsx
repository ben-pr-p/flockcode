import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Check, Circle, Loader } from 'lucide-react-native'
import { useColorScheme } from 'nativewind'
import type { ToolCallProps } from './types'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

interface TodoInput {
  todos: TodoItem[]
}

const PRIORITY_COLORS = {
  high: 'text-red-500 dark:text-red-400',
  medium: 'text-amber-500 dark:text-amber-400',
  low: 'text-stone-400 dark:text-stone-500',
}

const PRIORITY_BG = {
  high: 'bg-red-50 dark:bg-red-900/20',
  medium: 'bg-amber-50 dark:bg-amber-900/20',
  low: 'bg-stone-100 dark:bg-stone-800',
}

function TodoToolCollapsed({ description, toolMeta }: ToolCallProps) {
  const input = toolMeta.input as TodoInput | undefined
  const todos = input?.todos || []

  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length

  let displayText = description
  if (total > 0) {
    displayText = `${total} item${total !== 1 ? 's' : ''}`
    if (completed > 0) {
      displayText += ` (${completed} done)`
    }
  }

  return (
    <Text
      className="text-[13px] font-medium text-amber-600 dark:text-amber-500"
      style={{ fontFamily: 'JetBrains Mono' }}
      numberOfLines={1}
    >
      {displayText}
    </Text>
  )
}

function TodoItemRow({ item, index }: { item: TodoItem; index: number }) {
  const { colorScheme } = useColorScheme()
  const iconColor = colorScheme === 'dark' ? '#A8A29E' : '#78716C'

  const StatusIcon = () => {
    switch (item.status) {
      case 'completed':
        return <Check size={14} color={colorScheme === 'dark' ? '#4ade80' : '#16a34a'} />
      case 'in_progress':
        return <Loader size={14} color={colorScheme === 'dark' ? '#fbbf24' : '#d97706'} className="animate-spin" />
      case 'cancelled':
        return <Circle size={14} color={colorScheme === 'dark' ? '#57534E' : '#A8A29E'} />
      case 'pending':
      default:
        return <Circle size={14} color={iconColor} />
    }
  }

  const statusOpacity = item.status === 'cancelled' ? 0.5 : 1

  return (
    <View
      className={`flex-row items-start gap-2 p-2 rounded-md ${PRIORITY_BG[item.priority]}`}
      style={{ opacity: statusOpacity }}
    >
      <View className="mt-0.5">
        <StatusIcon />
      </View>
      <View className="flex-1">
        <Text
          className={`text-[12px] ${item.status === 'completed' ? 'text-stone-400 dark:text-stone-500 line-through' : 'text-stone-700 dark:text-stone-300'}`}
          style={{ fontFamily: 'JetBrains Mono' }}
        >
          {item.content}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Text
          className={`text-[10px] ${PRIORITY_COLORS[item.priority]}`}
          style={{ fontFamily: 'JetBrains Mono' }}
        >
          {item.priority}
        </Text>
      </View>
    </View>
  )
}

function TodoToolExpanded({ toolMeta }: ToolCallProps) {
  const input = toolMeta.input as TodoInput | undefined
  const todos = input?.todos || []
  const error = toolMeta.error

  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length
  const pending = todos.filter(t => t.status === 'pending').length

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full bg-green-500" />
          <Text className="text-[10px] text-stone-500 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
            {completed} done
          </Text>
        </View>
        {inProgress > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-amber-500" />
            <Text className="text-[10px] text-stone-500 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
              {inProgress} active
            </Text>
          </View>
        )}
        {pending > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-stone-400" />
            <Text className="text-[10px] text-stone-500 dark:text-stone-400" style={{ fontFamily: 'JetBrains Mono' }}>
              {pending} pending
            </Text>
          </View>
        )}
      </View>

      {error && (
        <View className="gap-1">
          <Text className="text-[10px] font-semibold text-red-400 uppercase" style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Error
          </Text>
          <View className="bg-red-50 dark:bg-red-900/20 rounded-md p-2">
            <Text
              className="text-[12px] text-red-600 dark:text-red-400"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              {error}
            </Text>
          </View>
        </View>
      )}

      {todos.length > 0 && !error && (
        <View className="gap-1">
          <Text className="text-[10px] font-semibold text-stone-400 uppercase" style={{ fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
            Tasks
          </Text>
          <ScrollView
            style={{ maxHeight: 300 }}
            nestedScrollEnabled
          >
            <View className="gap-2">
              {todos.map((item, idx) => (
                <TodoItemRow key={idx} item={item} index={idx} />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {todos.length === 0 && !error && (
        <Text
          className="text-[12px] text-stone-400 italic"
          style={{ fontFamily: 'JetBrains Mono' }}
        >
          No tasks
        </Text>
      )}
    </View>
  )
}

export { TodoToolCollapsed, TodoToolExpanded }
