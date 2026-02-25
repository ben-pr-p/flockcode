import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { MultiFileDiff } from "@pierre/diffs/react"

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(data: string): void
    }
  }
}

function postToNative(data: Record<string, unknown>) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(data))
}

type DiffData = {
  file: string
  before: string
  after: string
}

function App() {
  const [diff, setDiff] = useState<DiffData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session")
    const file = params.get("file")

    if (!sessionId || !file) {
      setError("Missing session or file param")
      return
    }

    fetch(`/api/diff?session=${encodeURIComponent(sessionId)}&file=${encodeURIComponent(file)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: DiffData) => setDiff(data))
      .catch((err) => setError(String(err)))
  }, [])

  // Post height changes back to native for auto-resizing
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      postToNative({ type: "resize", height: document.body.scrollHeight })
    })
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    postToNative({ type: "ready" })
  }, [])

  if (error) {
    return <div style={{ padding: 16, color: "#EF4444", fontFamily: "monospace" }}>{error}</div>
  }

  if (!diff) {
    return <div style={{ padding: 16, color: "#64748B", fontFamily: "monospace" }}>Loading...</div>
  }

  return (
    <MultiFileDiff
      oldFile={{ name: diff.file, contents: diff.before }}
      newFile={{ name: diff.file, contents: diff.after }}
      options={{ theme: "pierre-dark", diffStyle: "unified", disableFileHeader: true }}
    />
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
