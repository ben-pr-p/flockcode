import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { asyncStorageAdapter } from '../lib/jotai-async-storage'

/** Pinned sessions persisted across app restarts. */
export const pinnedSessionIdsAtom = atomWithStorage<string[]>(
  'sessions:pinned',
  [],
  asyncStorageAdapter<string[]>(),
)

/** Search state atoms for the UI. */
export const projectSearchQueryAtom = atom('')
export const projectFilterAtom = atom<string | null>(null)
export const sessionSearchQueryAtom = atom('')

/** Active tab in the current session view. */
export const activeTabAtom = atom<'session' | 'changes'>('session')

/** iPad split layout left panel content. */
export type LeftPanelContent =
  | { type: 'changes' }
  | { type: 'tool-detail'; messageId: string }

export const leftPanelContentAtom = atom<LeftPanelContent>({ type: 'changes' })
