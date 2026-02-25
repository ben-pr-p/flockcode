import type { Project } from '../../server/src/types'

const NOW = Date.now()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// The SDK type doesn't include `updated` on time, but the API returns it.
// Cast to satisfy the type checker while keeping realistic fixture data.
export const FIXTURE_PROJECTS = [
  {
    id: 'proj-1',
    worktree: '/Users/me/dsa/opencode-rn',
    vcs: 'git' as const,
    time: { created: NOW - 30 * DAY, updated: NOW - 2 * MINUTE },
  },
  {
    id: 'proj-7',
    worktree: '/Users/me/dsa/design-system',
    vcs: 'git' as const,
    time: { created: NOW - 60 * DAY, updated: NOW - 15 * MINUTE },
  },
  {
    id: 'proj-2',
    worktree: '/Users/me/dsa/canvass-map',
    vcs: 'git' as const,
    time: { created: NOW - 90 * DAY, updated: NOW - 3 * HOUR },
  },
  {
    id: 'proj-3',
    worktree: '/Users/me/projects/api-server',
    vcs: 'git' as const,
    time: { created: NOW - 20 * DAY, updated: NOW - 8 * HOUR },
  },
  {
    id: 'proj-4',
    worktree: '/Users/me/projects/blog-engine',
    vcs: 'git' as const,
    time: { created: NOW - 45 * DAY, updated: NOW - 1 * DAY },
  },
  {
    id: 'proj-5',
    worktree: '/Users/me/research/ml-pipeline',
    vcs: 'git' as const,
    time: { created: NOW - 120 * DAY, updated: NOW - 3 * DAY },
  },
  {
    id: 'proj-6',
    worktree: '/Users/me/projects/auth-service',
    vcs: 'git' as const,
    time: { created: NOW - 50 * DAY, updated: NOW - 7 * DAY },
  },
  {
    id: 'proj-8',
    worktree: '/Users/me/research/data-viz',
    vcs: 'git' as const,
    time: { created: NOW - 100 * DAY, updated: NOW - 14 * DAY },
  },
] satisfies Project[]
