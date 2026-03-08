import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { apiClientAtom } from '../lib/api'

// UI ChangedFile type that components expect
export interface ChangedFile {
  path: string
  status: 'added' | 'deleted' | 'modified'
  added: number
  removed: number
}

const POLL_INTERVAL = 2000

export function useChanges(sessionId: string | undefined): { data: ChangedFile[]; isLoading: boolean } {
  const api = useAtomValue(apiClientAtom)
  const [data, setData] = useState<ChangedFile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      setData([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const load = async () => {
      try {
        const res = await api.api.sessions[':sessionId'].changes.$get({
          param: { sessionId },
        })
        if (!res.ok) throw new Error('Failed to fetch changes')
        const changes = await res.json()
        if (!cancelled) {
          setData(changes as ChangedFile[])
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[useChanges] fetch failed:', err)
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    const interval = setInterval(() => {
      if (!cancelled) load()
    }, POLL_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [api, sessionId])

  return { data, isLoading }
}
