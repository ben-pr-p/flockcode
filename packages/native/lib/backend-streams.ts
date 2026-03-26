import { atom } from 'jotai';
import type { BackendUrl } from '../state/backends';
import type { UnifiedDB } from './stream-db';
import type { ApiClient } from './api';

/** Per-backend resources: unified DB + API client. */
export interface BackendResources {
  url: BackendUrl;
  /** Single DB containing all collections (state, ephemeral, app) */
  db: UnifiedDB | null;
  api: ApiClient | null;
  loading: boolean;
}

/**
 * Map of backend URL -> BackendResources.
 * Populated by the connection manager; consumed by merged query hooks.
 */
export const backendResourcesAtom = atom<Record<BackendUrl, BackendResources>>(
  {} as Record<BackendUrl, BackendResources>,
);
