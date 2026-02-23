import { useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { sessionCollection } from '../db/collections'
import { useProjects } from './useProjects'

const DAY = 24 * 60 * 60_000

export interface SidebarSession {
  id: string
  name: string
  projectName: string
  status: 'active' | 'idle'
  relativeTime: string
  updatedAt: number
}

export interface GroupedSessions {
  recent: SidebarSession[]
  earlier: SidebarSession[]
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function useSidebarSessions(
  projectId: string | undefined,
  searchQuery: string
): { data: GroupedSessions; isLoading: boolean } {
  const { data: sessions, isLoading } = useLiveQuery(sessionCollection)
  const { data: projects } = useProjects()

  const grouped = useMemo(() => {
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    const mapped = (sessions ?? [])
      .filter((s) => !projectId || s.projectId === projectId)
      .map((s): SidebarSession => {
        const isActive = Date.now() - s.updatedAt < 5 * 60_000
        return {
          id: s.id,
          name: s.title || 'Untitled',
          projectName: projectMap.get(s.projectId) ?? 'unknown',
          status: isActive ? 'active' : 'idle',
          relativeTime: formatRelativeTime(s.updatedAt),
          updatedAt: s.updatedAt,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const filtered = searchQuery
      ? mapped.filter(
          (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.projectName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : mapped

    const cutoff = Date.now() - DAY
    return {
      recent: filtered.filter((s) => s.updatedAt >= cutoff),
      earlier: filtered.filter((s) => s.updatedAt < cutoff),
    }
  }, [sessions, projects, projectId, searchQuery])

  return { data: grouped, isLoading }
}
