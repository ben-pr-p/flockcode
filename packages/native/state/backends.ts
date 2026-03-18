import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { asyncStorageAdapter } from '../lib/jotai-async-storage';

// --- Branded types ---

/** A backend server URL, used as the stable unique identifier for a backend. */
export type BackendUrl = string & { readonly __brand: 'BackendUrl' };

/** An absolute path to a git worktree on a specific backend machine. */
export type WorktreePath = string & { readonly __brand: 'WorktreePath' };

/** Backend type — affects UI hints and icons. */
export type BackendType = 'local' | 'sprite';

/** Configuration for a single backend server. */
export interface BackendConfig {
  /**
   * The server URL — serves as both the connection target and the stable unique
   * identifier for this backend. e.g. "http://localhost:3000" or
   * "https://my-sprite.sprites.dev"
   */
  url: BackendUrl;
  /** Human-readable label, e.g. "My MacBook", "Fly Sprite" */
  name: string;
  /** Backend type — affects UI hints and icons */
  type: BackendType;
  /** Whether this backend is active. Disabled backends are not connected to. */
  enabled: boolean;
  /** Optional bearer token for authenticated backends (Sprites). */
  authToken?: string;
}

/** Connection status for a single backend. */
export type BackendStatus = 'connected' | 'reconnecting' | 'error' | 'offline';

/** Live connection state for a single backend. */
export interface BackendConnection {
  url: BackendUrl;
  status: BackendStatus;
  instanceId: string | null;
  latencyMs: number | null;
  error: string | null;
}

/**
 * Persisted list of backend configurations.
 * Starts empty — user must add backends in Settings.
 */
export const backendsAtom = atomWithStorage<BackendConfig[]>(
  'settings:backends',
  [],
  asyncStorageAdapter<BackendConfig[]>(),
);

/**
 * Map of backend URL -> BackendConnection.
 * Updated by the connection manager hook.
 */
export const backendConnectionsAtom = atom<Record<BackendUrl, BackendConnection>>(
  {} as Record<BackendUrl, BackendConnection>,
);
