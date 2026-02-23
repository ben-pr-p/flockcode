import { QueryClient } from '@tanstack/react-query'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { createApi } from '../lib/api'
import type { Project, Session } from '../../server/src/types'

export const queryClient = new QueryClient()

let currentServerUrl = 'https://api.opencode.dev'

export function setServerUrl(url: string) {
  if (url === currentServerUrl) return
  currentServerUrl = url
  queryClient.invalidateQueries({ queryKey: ['projects'] })
  queryClient.invalidateQueries({ queryKey: ['sessions'] })
}

export const projectCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      const api = createApi(currentServerUrl)
      return api.listProjects()
    },
    queryClient,
    getKey: (item) => item.id,
  })
)

export const sessionCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['sessions'],
    queryFn: async (): Promise<Session[]> => {
      const api = createApi(currentServerUrl)
      return api.listSessions()
    },
    queryClient,
    getKey: (item) => item.id,
  })
)
