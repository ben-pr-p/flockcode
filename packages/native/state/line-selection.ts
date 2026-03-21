import { atom } from 'jotai'

/** A line range selected by the user inside the diff viewer. */
export interface LineSelection {
  file: string
  startLine: number
  endLine: number
  side?: 'additions' | 'deletions'
}

/** Current line selection in the diff viewer, or null when nothing is selected. */
export const lineSelectionAtom = atom<LineSelection | null>(null)
