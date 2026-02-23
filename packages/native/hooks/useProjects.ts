import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useLiveQuery } from '@tanstack/react-db'
import { serverUrlAtom } from '../state/settings'
import { projectCollection, setServerUrl } from '../db/collections'
import type { Project } from '../../server/src/types'

export type { Project }

export function useProjects() {
  const serverUrl = useAtomValue(serverUrlAtom)

  useEffect(() => {
    setServerUrl(serverUrl)
  }, [serverUrl])

  const { data, isLoading, isError } = useLiveQuery(projectCollection)

  return {
    data: data ?? [],
    isLoading,
    error: isError ? new Error('Failed to load projects') : null,
    refetch: () => projectCollection.utils.refetch(),
  }
}
