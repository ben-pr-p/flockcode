import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { hc } from 'hono/client';
import { createStreamDB } from '@durable-streams/state';
import type { AppType } from '../../server/src/app';
import {
  backendsAtom,
  backendConnectionsAtom,
  type BackendConfig,
  type BackendConnection,
  type BackendUrl,
} from '../state/backends';
import { backendResourcesAtom, type BackendResources } from '../lib/backend-streams';
import { stateSchema, appStateSchema, type StateDB, type AppStateDB } from '../lib/stream-db';
import type { ApiClient } from '../lib/api';

const POLL_INTERVAL = 10_000;

interface PerBackendState {
  instanceId: string | null;
  db: StateDB | null;
  appDb: AppStateDB | null;
  api: ApiClient | null;
  intervalId: ReturnType<typeof setInterval> | null;
  abortController: AbortController | null;
  cancelled: boolean;
}

/**
 * Creates an authenticated Hono RPC client for a backend.
 * If authToken is provided, injects the Authorization header on every request.
 */
function createApiClient(url: string, authToken?: string): ApiClient {
  const cleanUrl = url.replace(/\/$/, '');
  if (authToken) {
    return hc<AppType>(cleanUrl, {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string>),
            Authorization: `Bearer ${authToken}`,
          },
        }),
    });
  }
  return hc<AppType>(cleanUrl);
}

/**
 * Creates a StateDB connected to a backend's ephemeral stream.
 */
function createStateDB(
  url: string,
  instanceId: string,
  authToken?: string,
): StateDB {
  const cleanUrl = url.replace(/\/$/, '');
  return createStreamDB({
    streamOptions: {
      url: `${cleanUrl}/${instanceId}`,
      ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
    },
    state: stateSchema,
  }) as StateDB;
}

/**
 * Creates an AppStateDB connected to a backend's persistent app stream.
 */
function createAppStateDB(url: string, authToken?: string): AppStateDB {
  const cleanUrl = url.replace(/\/$/, '');
  return createStreamDB({
    streamOptions: {
      url: `${cleanUrl}/app`,
      ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
    },
    state: appStateSchema,
  }) as AppStateDB;
}

/**
 * Core orchestration hook that manages connections to all enabled backends.
 *
 * Replaces useServerHealth, the debounce logic in useSettings, and the
 * implicit stream setup in stream-db.ts atoms.
 *
 * Responsibilities per enabled backend:
 * 1. Poll GET /health every 10s — returns instanceId + health status
 * 2. Detect instanceId changes (server restart) -> tear down and recreate StreamDBs
 * 3. Create hc<AppType>(url) API client (with auth header if authToken is set)
 * 4. Create ephemeral StreamDB at ${url}/${instanceId}
 * 5. Create persistent StreamDB at ${url}/app
 * 6. Write results to backendConnectionsAtom and backendResourcesAtom
 *
 * Mount once at the app root.
 */
export function useBackendManager() {
  const backends = useAtomValue(backendsAtom);
  const resolvedBackends = backends instanceof Promise ? [] : backends;
  const setConnections = useSetAtom(backendConnectionsAtom);
  const setResources = useSetAtom(backendResourcesAtom);

  // Track per-backend state across renders
  const stateRef = useRef<Map<BackendUrl, PerBackendState>>(new Map());

  useEffect(() => {
    const enabledBackends = resolvedBackends.filter((b) => b.enabled);
    const enabledUrls = new Set(enabledBackends.map((b) => b.url));

    // Tear down backends that are no longer enabled
    for (const [url, state] of stateRef.current) {
      if (!enabledUrls.has(url)) {
        tearDown(state);
        stateRef.current.delete(url);
        // Remove from atoms
        setConnections((prev) => {
          const next = { ...prev };
          delete next[url];
          return next;
        });
        setResources((prev) => {
          const next = { ...prev };
          delete next[url];
          return next;
        });
      }
    }

    // Start/update per-backend loops
    for (const backend of enabledBackends) {
      if (stateRef.current.has(backend.url)) {
        // Already running — update is handled by the existing loop detecting
        // config changes via the backend reference
        continue;
      }

      const perBackend: PerBackendState = {
        instanceId: null,
        db: null,
        appDb: null,
        api: null,
        intervalId: null,
        abortController: null,
        cancelled: false,
      };
      stateRef.current.set(backend.url, perBackend);

      // Set initial connection state
      setConnections((prev) => ({
        ...prev,
        [backend.url]: {
          url: backend.url,
          status: 'reconnecting',
          instanceId: null,
          latencyMs: null,
          error: null,
        } satisfies BackendConnection,
      }));

      // Set initial resources
      setResources((prev) => ({
        ...prev,
        [backend.url]: {
          url: backend.url,
          db: null,
          appDb: null,
          api: null,
          loading: true,
        } satisfies BackendResources,
      }));

      // Create API client immediately
      perBackend.api = createApiClient(backend.url, backend.authToken);
      setResources((prev) => ({
        ...prev,
        [backend.url]: {
          ...prev[backend.url],
          api: perBackend.api,
        } as BackendResources,
      }));

      // Start health polling
      startPolling(backend, perBackend, setConnections, setResources);
    }

    return () => {
      // Cleanup all backends on unmount
      for (const [, state] of stateRef.current) {
        tearDown(state);
      }
      stateRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBackends]);
}

function startPolling(
  backend: BackendConfig,
  state: PerBackendState,
  setConnections: (fn: (prev: Record<string, BackendConnection>) => Record<string, BackendConnection>) => void,
  setResources: (fn: (prev: Record<string, BackendResources>) => Record<string, BackendResources>) => void,
) {
  async function poll() {
    if (state.cancelled) return;

    state.abortController?.abort();
    const controller = new AbortController();
    state.abortController = controller;

    const url = backend.url.replace(/\/$/, '') + '/health';
    const start = Date.now();

    try {
      const headers: Record<string, string> = {};
      if (backend.authToken) {
        headers.Authorization = `Bearer ${backend.authToken}`;
      }

      const res = await fetch(url, {
        signal: controller.signal,
        headers,
      });
      if (state.cancelled) return;

      if (!res.ok) {
        setConnections((prev) => ({
          ...prev,
          [backend.url]: {
            ...prev[backend.url],
            status: 'error',
            latencyMs: null,
            error: `HTTP ${res.status}`,
          } as BackendConnection,
        }));
        return;
      }

      const latency = Date.now() - start;
      const data = await res.json();
      const newInstanceId = data.instanceId as string | undefined;

      // Detect instanceId change (server restart)
      if (newInstanceId && newInstanceId !== state.instanceId) {
        // Tear down old StreamDBs
        if (state.db) {
          try { state.db.close(); } catch { /* ignore */ }
        }

        state.instanceId = newInstanceId;

        // Create new StreamDBs
        try {
          const db = createStateDB(backend.url, newInstanceId, backend.authToken);
          await db.preload();
          state.db = db;
        } catch (err) {
          console.error(`[useBackendManager] Failed to create StateDB for ${backend.url}:`, err);
          state.db = null;
        }

        // Create app DB (only on first connect — the /app stream is persistent)
        if (!state.appDb) {
          try {
            const appDb = createAppStateDB(backend.url, backend.authToken);
            await appDb.preload();
            state.appDb = appDb;
          } catch (err) {
            console.error(`[useBackendManager] Failed to create AppStateDB for ${backend.url}:`, err);
            state.appDb = null;
          }
        }

        // Update resources atom
        setResources((prev) => ({
          ...prev,
          [backend.url]: {
            url: backend.url,
            db: state.db,
            appDb: state.appDb,
            api: state.api,
            loading: false,
          } satisfies BackendResources,
        }));
      }

      // Update connection state
      setConnections((prev) => ({
        ...prev,
        [backend.url]: {
          url: backend.url,
          status: 'connected',
          instanceId: newInstanceId ?? state.instanceId,
          latencyMs: latency,
          error: null,
        } satisfies BackendConnection,
      }));
    } catch (err: any) {
      if (state.cancelled) return;
      if (err.name === 'AbortError') return;

      setConnections((prev) => ({
        ...prev,
        [backend.url]: {
          ...prev[backend.url],
          status: 'error',
          latencyMs: null,
          error: err.message || 'Connection failed',
        } as BackendConnection,
      }));
    }
  }

  // Initial poll
  poll();
  // Periodic polling
  state.intervalId = setInterval(poll, POLL_INTERVAL);
}

function tearDown(state: PerBackendState) {
  state.cancelled = true;
  if (state.intervalId) clearInterval(state.intervalId);
  state.abortController?.abort();
  if (state.db) {
    try { state.db.close(); } catch { /* ignore */ }
  }
  if (state.appDb) {
    try { state.appDb.close(); } catch { /* ignore */ }
  }
}
