import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { apiClientAtom } from '../lib/api'

export interface FileDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}

const POLL_INTERVAL = 2000

export function useDiffs(sessionId: string | undefined): { data: FileDiff[]; isLoading: boolean } {
  const api = useAtomValue(apiClientAtom)
  const [data, setData] = useState<FileDiff[]>([])
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
        const res = await api.api.diffs.$get({
          query: { session: sessionId },
        })
        if (!res.ok) throw new Error('Failed to fetch diffs')
        const diffs = await res.json()
        if (!cancelled) {
          setData(diffs as FileDiff[])
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[useDiffs] fetch failed:', err)
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
