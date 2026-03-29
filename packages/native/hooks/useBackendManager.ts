import { useRef } from 'react';
import { createEffect, useLiveQuery, eq } from '@tanstack/react-db';
import { appendStreamToDb, type StreamHandle } from '../lib/durable-streams';
import { collections, collectionEntries } from '../lib/collections';
import {
  STATE_STREAM_COLLECTIONS,
  EPHEMERAL_STREAM_COLLECTIONS,
  APP_STREAM_COLLECTIONS,
  type BackendConfigValue,
  type BackendConnectionValue,
} from '../lib/stream-db';

const POLL_INTERVAL = 5_000;

/**
 * Core orchestration hook that manages connections to all enabled backends.
 *
 * Reads backend configs from the global DB's `backends` collection (local-only,
 * persisted). For each enabled backend:
 * 1. Poll GET /health every 10s — returns instanceId + health status
 * 2. Write connection status to `backendConnections` collection
 * 3. Detect instanceId changes (server restart) -> close instance-scoped
 *    streams, create new ones against the new instanceId
 * 4. Attach state/ephemeral/app streams to the global DB with backendUrl stamping
 *
 * Mount once at the app root.
 */
type StopPollingFn = () => void;
type BackendStateContainer = {
  url: string;
  authToken: string | null;
  stopPollingFn: StopPollingFn;
};
export function useBackendManager() {
  const backendPolls = useRef<Record<string, BackendStateContainer>>({});

  const { data: backendConfigs } = useLiveQuery(
    (q) => q.from({ backends: collections.backends }),
    []
  );

  /**
   * Start polling for each enabled backend on mount or enable
   * Stop polling for removed or disabled backends
   * TODO: Need to think through auth/url changing (can key polling by map)
   */
  createEffect({
    query: (q) =>
      q.from({ backends: collections.backends }).where((b) => eq(b.backends.enabled, true)),
    skipInitial: false,
    onEnter(result) {
      const backend = result.value as BackendConfigValue;
      // Guard against duplicate onEnter (e.g. React strict mode re-renders)
      if (backendPolls.current[backend.id]) return;
      backendPolls.current[backend.id] = {
        url: backend.url,
        authToken: backend.authToken ?? null,
        stopPollingFn: startPolling(backend),
      };
    },
    onUpdate(result) {
      const backend = result.value as BackendConfigValue;
      const prior = backendPolls.current[backend.id];
      if (!prior) {
        // polling never set up before (unexpected on update)
        console.warn(`Polling not set up for backend ${backend.id}`);
        backendPolls.current[backend.id] = {
          url: backend.url,
          authToken: backend.authToken ?? null,
          stopPollingFn: startPolling(backend),
        };
      } else if (backend.url !== prior.url || backend.authToken !== prior.authToken) {
        // url or auth token changed — restart polling
        prior.stopPollingFn();
        backendPolls.current[backend.id] = {
          url: backend.url,
          authToken: backend.authToken ?? null,
          stopPollingFn: startPolling(backend),
        };
      } else {
        // something like name changed, we don't need to do anything
      }
    },
    onExit(result) {
      const backend = result.value as BackendConfigValue;
      if (backendPolls.current[backend.id]) {
        backendPolls.current[backend.id].stopPollingFn();
        delete backendPolls.current[backend.id];
      }
    },
  });
}

/**
 * Write or delete a backend connection status in the global DB's
 * backendConnections collection.
 */
function updateConnection(url: string, value: BackendConnectionValue | null) {
  if (value === null) {
    try {
      collections.backendConnections.delete(url);
    } catch {
      /* ignore if not found */
    }
  } else {
    try {
      collections.backendConnections.insert(value);
    } catch {
      // Already exists — update instead
      collections.backendConnections.update(url, (draft: any) => {
        Object.assign(draft, value);
      });
    }
  }
}

function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/**
 * Start polling a backend's /health endpoint. Returns a teardown function
 * that cancels polling and closes all streams.
 */
function startPolling(backend: BackendConfigValue): () => void {
  let instanceId: string | null = null;
  let stateStream: StreamHandle | null = null;
  let ephemeralStream: StreamHandle | null = null;
  let appStream: StreamHandle | null = null;
  let cancelled = false;

  const cleanBaseUrl = backend.url.replace(/\/$/, '');

  /** Attach a stream, logging errors instead of throwing. */
  function attachStream(
    pathSuffix: string,
    collectionNames: readonly string[]
  ): StreamHandle | null {
    try {
      const s = appendStreamToDb(collectionEntries, {
        streamOptions: {
          url: `${cleanBaseUrl}${pathSuffix}`,
          headers: authHeaders(backend.authToken),
        },
        collectionNames: [...collectionNames],
        backendUrl: backend.url,
      });
      s.preload();
      console.log(`[poll] Stream attached: ${pathSuffix}`, backend.url);
      return s;
    } catch (err) {
      console.error(
        `[useBackendManager] Failed to attach stream ${pathSuffix} for ${backend.url}:`,
        err
      );
      return null;
    }
  }

  async function poll() {
    if (cancelled) return;

    const start = Date.now();

    try {
      const res = await fetch(cleanBaseUrl + '/health', {
        headers: authHeaders(backend.authToken),
      });

      if (cancelled) return;

      if (!res.ok) {
        updateConnection(backend.url, {
          url: backend.url,
          status: 'error',
          instanceId,
          latencyMs: null,
          error: `HTTP ${res.status}`,
        });
        return;
      }

      const latency = Date.now() - start;

      // Server is reachable — mark connected immediately
      updateConnection(backend.url, {
        url: backend.url,
        status: 'connected',
        instanceId,
        latencyMs: latency,
        error: null,
      });

      const data = await res.json();
      const newInstanceId = data.instanceId as string | undefined;

      console.log('[poll]', {
        newInstanceId,
        currentInstanceId: instanceId,
        willAttachStreams: !!(newInstanceId && newInstanceId !== instanceId),
      });

      // Detect instanceId change (server restart)
      if (newInstanceId && newInstanceId !== instanceId) {
        // Close old instance-scoped streams (state + ephemeral)
        closeStreamSafe(stateStream);
        closeStreamSafe(ephemeralStream);
        stateStream = null;
        ephemeralStream = null;

        instanceId = newInstanceId;

        stateStream = attachStream(`/${newInstanceId}`, STATE_STREAM_COLLECTIONS);

        ephemeralStream = attachStream(`/${newInstanceId}/ephemeral`, EPHEMERAL_STREAM_COLLECTIONS);

        // Attach app stream only once — survives instanceId changes
        if (!appStream) {
          appStream = attachStream('/app', APP_STREAM_COLLECTIONS);
        }
      }
    } catch (err: any) {
      if (cancelled) return;

      updateConnection(backend.url, {
        url: backend.url,
        status: 'error',
        instanceId,
        latencyMs: null,
        error: err.message || 'Connection failed',
      });
    }
  }

  poll();
  const intervalId = setInterval(poll, POLL_INTERVAL);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
    closeStreamSafe(stateStream);
    closeStreamSafe(ephemeralStream);
    closeStreamSafe(appStream);
  };
}

function closeStreamSafe(handle: StreamHandle | null) {
  if (!handle) return;
  try {
    handle.close();
  } catch {
    /* ignore */
  }
}
