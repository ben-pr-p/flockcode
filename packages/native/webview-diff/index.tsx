import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MultiFileDiff, PatchDiff } from '@pierre/diffs/react'

type DiffPayload =
  | {
      type: 'files'
      oldFile: { name: string; contents: string }
      newFile: { name: string; contents: string }
      theme?: string
      diffStyle?: 'split' | 'unified'
    }
  | {
      type: 'patch'
      patch: string
      theme?: string
      diffStyle?: 'split' | 'unified'
    }

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(data: string): void
    }
  }
}

function App() {
  const [payload, setPayload] = useState<DiffPayload | null>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data: DiffPayload = JSON.parse(event.data)
        setPayload(data)
      } catch {
        // ignore non-JSON messages
      }
    }

    window.addEventListener('message', handler)
    document.addEventListener('message', handler as EventListener)

    // Signal to React Native that the WebView is ready
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }))
    }

    return () => {
      window.removeEventListener('message', handler)
      document.removeEventListener('message', handler as EventListener)
    }
  }, [])

  // Post height changes back to native for auto-resizing
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'resize', height: document.body.scrollHeight }),
      )
    })
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  if (!payload) {
    return <div style={{ padding: 16, color: '#888' }}>Waiting for diff data...</div>
  }

  const theme = payload.theme ?? 'pierre-dark'
  const diffStyle = payload.diffStyle ?? 'unified'

  if (payload.type === 'patch') {
    return <PatchDiff patch={payload.patch} options={{ theme, diffStyle }} />
  }

  return (
    <MultiFileDiff
      oldFile={payload.oldFile}
      newFile={payload.newFile}
      options={{ theme, diffStyle }}
    />
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
