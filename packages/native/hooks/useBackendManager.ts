import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { loadable } from 'jotai/utils';
import {
  createDbWithNoStreams,
  appendStreamToDb,
  type StreamHandle,
  type MultiStreamDB,
} from '../lib/durable-streams';
import {
  backendsAtom,
  backendConnectionsAtom,
  type BackendConfig,
  type BackendConnection,
  type BackendUrl,
} from '../state/backends';
import { backendResourcesAtom, type BackendResources } from '../lib/backend-streams';
import {
  unifiedStateDef,
  PERSISTED_COLLECTION_NAMES,
  STATE_STREAM_COLLECTIONS,
  EPHEMERAL_STREAM_COLLECTIONS,
  APP_STREAM_COLLECTIONS,
  type UnifiedDB,
} from '../lib/stream-db';
import { createApiClient, type ApiClient } from '../lib/api';
import { createPersistedCollectionFn } from '../lib/persistence';

const POLL_INTERVAL = 10_000;

interface PerBackendState {
  instanceId: string | null;
  /** Single DB with all collections for this backend */
  db: UnifiedDB | null;
  /** Internal ref for the _entries map needed by appendStreamToDb */
  dbInternal: (UnifiedDB & { _entries: Map<string, any> }) | null;
  /** Stream handles for lifecycle management */
  stateStream: StreamHandle | null;
  ephemeralStream: StreamHandle | null;
  appStream: StreamHandle | null;
  api: ApiClient | null;
  intervalId: ReturnType<typeof setInterval> | null;
  abortController: AbortController | null;
  cancelled: boolean;
}

// Loadable wrapper so we can distinguish "not yet loaded" from "loaded []"
const backendsLoadableAtom = loadable(backendsAtom);

/**
 * Core orchestration hook that manages connections to all enabled backends.
 *
 * Creates a single unified DB per backend with all collections, then attaches
 * three streams (state, ephemeral, app) that feed events into their respective
 * subsets of collections.
 *
 * Responsibilities per enabled backend:
 * 1. Poll GET /health every 10s — returns instanceId + health status
 * 2. Detect instanceId changes (server restart) -> close instance-scoped
 *    streams, create new ones against the new instanceId
 * 3. Create oRPC API client (with auth header if authToken is set)
 * 4. Create unified DB (once per backend) with all collections
 * 5. Attach state stream at ${url}/${instanceId}
 * 6. Attach ephemeral stream at ${url}/${instanceId}/ephemeral
 * 7. Attach app stream at ${url}/app (survives instanceId changes)
 * 8. Write results to backendConnectionsAtom and backendResourcesAtom
 *
 * Mount once at the app root.
 */
export function useBackendManager() {
  const backendsLoadable = useAtomValue(backendsLoadableAtom);
  const setConnections = useSetAtom(backendConnectionsAtom);
  const setResources = useSetAtom(backendResourcesAtom);

  // Track per-backend state across renders
  const stateRef = useRef<Map<BackendUrl, PerBackendState>>(new Map());

  useEffect(() => {
    // Wait for AsyncStorage to resolve before acting
    if (backendsLoadable.state !== 'hasData') return;

    const enabledBackends = backendsLoadable.data.filter((b) => b.enabled);
    const enabledUrls = new Set(enabledBackends.map((b) => b.url));

    // Compute action buckets against the ref now (inside the effect, always current)
    const toTearDown = [...stateRef.current.keys()].filter((url) => !enabledUrls.has(url));
    const toStart = enabledBackends.filter((b) => !stateRef.current.has(b.url));
    const _alreadyRunning = enabledBackends.filter((b) => stateRef.current.has(b.url));

    // --- Tear down removed backends ---
    for (const url of toTearDown) {
      const state = stateRef.current.get(url);
      if (state) tearDown(state);
      stateRef.current.delete(url);
    }
    if (toTearDown.length > 0) {
      setConnections((prev) => {
        const next = { ...prev };
        for (const url of toTearDown) delete next[url];
        return next;
      });
      setResources((prev) => {
        const next = { ...prev };
        for (const url of toTearDown) delete next[url];
        return next;
      });
    }

    // --- Initialize and start polling for new backends ---
    for (const backend of toStart) {
      const perBackend: PerBackendState = {
        instanceId: null,
        db: null,
        dbInternal: null,
        stateStream: null,
        ephemeralStream: null,
        appStream: null,
        api: null,
        intervalId: null,
        abortController: null,
        cancelled: false,
      };
      // Register in ref immediately so subsequent renders see it as already running
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

      // Create API client and set initial resources
      perBackend.api = createApiClient(backend.url, backend.authToken);
      setResources((prev) => ({
        ...prev,
        [backend.url]: {
          url: backend.url,
          db: null,
          api: perBackend.api,
          loading: true,
        } satisfies BackendResources,
      }));

      startPolling(backend, perBackend, setConnections, setResources);
    }
    // backendsLoadable changes identity each render when state is 'loading';
    // only re-run when it transitions to hasData or the data itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendsLoadable.state === 'hasData' ? backendsLoadable.data : null]);

  // Tear down all backends only on unmount
  useEffect(() => {
    return () => {
      for (const [, state] of stateRef.current) {
        tearDown(state);
      }
      stateRef.current.clear();
    };
  }, []);
}

/**
 * Build auth headers object if an auth token is present.
 */
function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function startPolling(
  backend: BackendConfig,
  state: PerBackendState,
  setConnections: (
    fn: (prev: Record<string, BackendConnection>) => Record<string, BackendConnection>
  ) => void,
  setResources: (
    fn: (prev: Record<string, BackendResources>) => Record<string, BackendResources>
  ) => void
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

      console.log('[poll]', {
        newInstanceId,
        currentInstanceId: state.instanceId,
        willCreateDB: !!(newInstanceId && newInstanceId !== state.instanceId),
      });

      // Detect instanceId change (server restart)
      if (newInstanceId && newInstanceId !== state.instanceId) {
        const cleanUrl = backend.url.replace(/\/$/, '');

        // Close old instance-scoped streams (state + ephemeral)
        // The app stream survives instanceId changes.
        closeStreamSafe(state.stateStream);
        closeStreamSafe(state.ephemeralStream);
        state.stateStream = null;
        state.ephemeralStream = null;

        state.instanceId = newInstanceId;

        // Create the unified DB once (on first instanceId) — collections persist
        // across instanceId changes. Only the streams are torn down and recreated.
        if (!state.dbInternal) {
          try {
            const db = createDbWithNoStreams({
              state: unifiedStateDef,
              createCollectionFn: createPersistedCollectionFn(PERSISTED_COLLECTION_NAMES),
            });
            state.dbInternal = db;
            state.db = db;
            console.log('[poll] Unified DB created', backend.url);
          } catch (err) {
            console.error(
              `[useBackendManager] Failed to create unified DB for ${backend.url}:`,
              err
            );
          }
        }

        if (state.dbInternal) {
          // Attach state stream (instance-scoped)
          try {
            const stateStream = appendStreamToDb(state.dbInternal, {
              streamOptions: {
                url: `${cleanUrl}/${newInstanceId}`,
                ...{ headers: authHeaders(backend.authToken) },
              },
              collectionNames: [...STATE_STREAM_COLLECTIONS],
            });
            await stateStream.preload();
            state.stateStream = stateStream;
            console.log('[poll] State stream attached', backend.url);
          } catch (err) {
            console.error(
              `[useBackendManager] Failed to attach state stream for ${backend.url}:`,
              err
            );
          }

          // Attach ephemeral stream (instance-scoped)
          try {
            const ephemeralStream = appendStreamToDb(state.dbInternal, {
              streamOptions: {
                url: `${cleanUrl}/${newInstanceId}/ephemeral`,
                ...{ headers: authHeaders(backend.authToken) },
              },
              collectionNames: [...EPHEMERAL_STREAM_COLLECTIONS],
            });
            await ephemeralStream.preload();
            state.ephemeralStream = ephemeralStream;
            console.log('[poll] Ephemeral stream attached', backend.url);
          } catch (err) {
            console.error(
              `[useBackendManager] Failed to attach ephemeral stream for ${backend.url}:`,
              err
            );
          }

          // Attach app stream (only once — survives instanceId changes)
          if (!state.appStream) {
            try {
              const appStream = appendStreamToDb(state.dbInternal, {
                streamOptions: {
                  url: `${cleanUrl}/app`,
                  ...{ headers: authHeaders(backend.authToken) },
                },
                collectionNames: [...APP_STREAM_COLLECTIONS],
              });
              await appStream.preload();
              state.appStream = appStream;
              console.log('[poll] App stream attached', backend.url);
            } catch (err) {
              console.error(
                `[useBackendManager] Failed to attach app stream for ${backend.url}:`,
                err
              );
            }
          }
        }

        // Publish updated resources
        setResources((prev) => ({
          ...prev,
          [backend.url]: {
            url: backend.url,
            db: state.db,
            api: state.api,
            loading: false,
          } satisfies BackendResources,
        }));
      }

      // Update connection status
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

  // Initial poll immediately, then on interval
  poll();
  state.intervalId = setInterval(poll, POLL_INTERVAL);
}

function closeStreamSafe(handle: StreamHandle | null) {
  if (!handle) return;
  try {
    handle.close();
  } catch {
    /* ignore */
  }
}

function tearDown(state: PerBackendState) {
  state.cancelled = true;
  if (state.intervalId) clearInterval(state.intervalId);
  state.abortController?.abort();

  // Close all stream handles
  closeStreamSafe(state.stateStream);
  closeStreamSafe(state.ephemeralStream);
  closeStreamSafe(state.appStream);

  // Close the unified DB (which also closes any remaining streams)
  if (state.db) {
    try {
      state.db.close();
    } catch {
      /* ignore */
    }
  }
}
