import React, { useCallback, useState } from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { useAtomValue } from 'jotai'
import { serverUrlAtom } from '../state/settings'

interface DiffWebViewProps {
  sessionId: string
  file: string
  style?: ViewStyle
  /** Fill parent and scroll internally instead of expanding to content height */
  scrollable?: boolean
}

export function DiffWebView({ sessionId, file, style, scrollable }: DiffWebViewProps) {
  const serverUrl = useAtomValue(serverUrlAtom)
  const [height, setHeight] = useState(300)

  const uri = `${serverUrl.replace(/\/$/, '')}/diff?session=${encodeURIComponent(sessionId)}&file=${encodeURIComponent(file)}`

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'resize') {
        setHeight(data.height)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <View style={[styles.container, scrollable ? { flex: 1 } : { height }, style]}>
      <WebView
        source={{ uri }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={scrollable ?? false}
        style={styles.webview}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { minHeight: 200 },
  webview: { flex: 1, backgroundColor: 'transparent' },
})
