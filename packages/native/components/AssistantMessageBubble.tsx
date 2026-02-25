import React from 'react'
import { View } from 'react-native'
import { StreamdownRN } from 'streamdown-rn'

interface AssistantMessageBubbleProps {
  content: string
}

export function AssistantMessageBubble({ content }: AssistantMessageBubbleProps) {
  return (
    <View className="items-start">
      <View className="max-w-[85%]">
        <StreamdownRN theme="dark" isComplete>
          {content}
        </StreamdownRN>
      </View>
    </View>
  )
}
