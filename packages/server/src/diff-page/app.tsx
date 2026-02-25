import React, { useState, useEffect, useCallback, useRef } from "react"
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
  const [diffs, setDiffs] = useState<DiffData[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load all diffs upfront on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session")

    if (!sessionId) {
      setError("Missing session param")
      return
    }

    fetch(`/api/diffs?session=${encodeURIComponent(sessionId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: DiffData[]) => {
        setDiffs(data)
        setLoaded(true)
        postToNative({ type: "loaded", files: data.map((d) => d.file) })
      })
      .catch((err) => setError(String(err)))
  }, [])

  // Listen for messages from React Native to switch files
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (msg.type === "showFile") {
          setActiveFile(msg.file)
        } else if (msg.type === "hide") {
          setActiveFile(null)
        }
      } catch {
        // ignore parse errors
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
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

  if (!loaded) {
    return <div style={{ padding: 16, color: "#64748B", fontFamily: "monospace" }}>Loading diffs...</div>
  }

  if (!activeFile) {
    return <div style={{ padding: 16, color: "#64748B", fontFamily: "monospace" }}>Ready</div>
  }

  const diff = diffs.find((d) => d.file === activeFile)
  if (!diff) {
    return <div style={{ padding: 16, color: "#EF4444", fontFamily: "monospace" }}>File not found: {activeFile}</div>
  }

  return (
    <MultiFileDiff
      key={activeFile}
      oldFile={{ name: diff.file, contents: diff.before }}
      newFile={{ name: diff.file, contents: diff.after }}
      options={{ theme: "pierre-dark", diffStyle: "unified", disableFileHeader: true }}
    />
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
