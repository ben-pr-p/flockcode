/**
 * MergedQuery — runs the same useLiveQuery against every connected backend's
 * unified DB, concatenates the results, and passes them to a render function.
 *
 * Each result item is augmented with a `backendUrl` field so the caller knows
 * which backend it came from.
 *
 * Uses a recursive component pattern to satisfy React's rules of hooks:
 * each recursion level renders one component that calls useLiveQuery exactly
 * once, then renders the next level with accumulated results.
 */
import React from 'react';
import { useAtomValue } from 'jotai/react';
import { useLiveQuery } from '@tanstack/react-db';
import type { InitialQueryBuilder, QueryBuilder } from '@tanstack/react-db';
import { backendResourcesAtom, type BackendResources } from './backend-streams';
import type { BackendUrl } from '../state/backends';
import type { UnifiedDB } from './stream-db';

/** Every item returned by a merged query carries its source backend URL. */
export type WithBackendUrl<T> = T & { backendUrl: BackendUrl };

// --- Unified query merging ---

interface MergedQueryProps<T> {
  /** Build a query from the unified DB. */
  query: (db: UnifiedDB, q: InitialQueryBuilder) => QueryBuilder<any> | undefined | null;
  /** Extra deps for the query. */
  deps?: unknown[];
  /** Render function receiving the merged, backend-tagged results. */
  children: (result: { data: WithBackendUrl<T>[] | null; isLoading: boolean }) => React.ReactNode;
}

/**
 * Runs a live query against every connected backend's unified DB, tags each
 * result with its source `backendUrl`, and concatenates them.
 *
 * This replaces MergedStateQuery, MergedEphemeralStateQuery, and
 * MergedAppStateQuery — all collections are in the unified DB.
 *
 * ```tsx
 * <MergedQuery<ProjectValue>
 *   query={(db, q) => q.from({ projects: db.collections.projects })}
 * >
 *   {({ data, isLoading }) => <ProjectList projects={data} />}
 * </MergedQuery>
 * ```
 */
export function MergedQuery<T>({ query, deps = [], children }: MergedQueryProps<T>) {
  const resourceMap = useAtomValue(backendResourcesAtom);
  const backends = Object.values(resourceMap).filter((r) => r.db != null);

  if (backends.length === 0) {
    return <>{children({ data: null, isLoading: true })}</>;
  }

  return (
    <QueryAccumulator<T>
      backends={backends}
      index={0}
      accumulated={[]}
      anyLoading={false}
      query={query}
      deps={deps}>
      {children}
    </QueryAccumulator>
  );
}

interface QueryAccumulatorProps<T> {
  backends: BackendResources[];
  index: number;
  accumulated: WithBackendUrl<T>[];
  anyLoading: boolean;
  query: (db: UnifiedDB, q: InitialQueryBuilder) => QueryBuilder<any> | undefined | null;
  deps: unknown[];
  children: (result: { data: WithBackendUrl<T>[] | null; isLoading: boolean }) => React.ReactNode;
}

function QueryAccumulator<T>({
  backends,
  index,
  accumulated,
  anyLoading,
  query,
  deps,
  children,
}: QueryAccumulatorProps<T>) {
  const backend = backends[index];
  const db = backend.db!;

  const result = useLiveQuery((q) => query(db, q), [db, ...deps]);
  const rawData = (result.data as T[] | null) ?? [];
  const tagged = rawData.map((item) => ({ ...item, backendUrl: backend.url }));
  const merged = [...accumulated, ...tagged];
  const loading = anyLoading || backend.loading || result.isLoading;

  if (index + 1 < backends.length) {
    return (
      <QueryAccumulator<T>
        backends={backends}
        index={index + 1}
        accumulated={merged}
        anyLoading={loading}
        query={query}
        deps={deps}>
        {children}
      </QueryAccumulator>
    );
  }

  return <>{children({ data: merged.length > 0 ? merged : null, isLoading: loading })}</>;
}

// --- Backwards-compatible aliases ---
// These re-export MergedQuery under the old names so existing consumers
// don't need to be updated in this commit. The query callback receives
// the full UnifiedDB, which is a superset of the old StateDB / EphemeralStateDB / AppStateDB.

/** @deprecated Use MergedQuery instead */
export const MergedStateQuery = MergedQuery;

/** @deprecated Use MergedQuery instead */
export const MergedEphemeralStateQuery = MergedQuery;

/** @deprecated Use MergedQuery instead */
export const MergedAppStateQuery = MergedQuery;

// --- Single-backend query hook ---

/**
 * Runs a live query against a single specific backend's unified DB.
 * Use this when you know which backend owns the data (e.g., session-scoped queries).
 */
export function useBackendQuery<T>(
  backendUrl: BackendUrl,
  query: (db: UnifiedDB, q: InitialQueryBuilder) => QueryBuilder<any> | undefined | null,
  deps: unknown[] = []
): { data: T[] | null; isLoading: boolean } {
  const resourceMap = useAtomValue(backendResourcesAtom);
  const resources = resourceMap[backendUrl];
  const db = resources?.db ?? null;
  const loading = resources?.loading ?? true;

  const result = useLiveQuery((q) => db && query(db, q), [db, ...deps]);
  if (!db) return { data: null, isLoading: true };
  return { data: result.data as T[] | null, isLoading: loading || result.isLoading };
}

/** @deprecated Use useBackendQuery instead */
export const useBackendStateQuery = useBackendQuery;

/** @deprecated Use useBackendQuery instead */
export const useBackendEphemeralStateQuery = useBackendQuery;

/** @deprecated Use useBackendQuery instead */
export const useBackendAppStateQuery = useBackendQuery;
