/**
 * TanStack DB SQLite persistence setup for React Native.
 *
 * Creates a shared persistence instance backed by op-sqlite and provides
 * a `createCollectionFn` that wraps stream-synced collections with
 * `persistedCollectionOptions()` for automatic SQLite persistence.
 */
import { open } from '@op-engineering/op-sqlite';
import {
  createReactNativeSQLitePersistence,
  persistedCollectionOptions,
} from '@tanstack/react-native-db-sqlite-persistence';
import { createCollection } from '@tanstack/db';
import type { Collection } from '@tanstack/db';
import type { OpSQLiteDatabaseLike } from '@tanstack/react-native-db-sqlite-persistence';
import type { CreateCollectionFn, StreamCollectionConfig } from './durable-streams';

// ---------------------------------------------------------------------------
// Shared SQLite database + persistence adapter
// ---------------------------------------------------------------------------

/**
 * Single op-sqlite database shared across all persisted collections.
 *
 * Cast needed because op-sqlite's `execute` param type (`Scalar[]`) is
 * narrower than what `OpSQLiteDatabaseLike` expects (`readonly unknown[]`).
 * At runtime the shapes are compatible.
 */
const db = open({ name: 'flockcode.sqlite' }) as unknown as OpSQLiteDatabaseLike;

/** Shared persistence adapter — one per app, reused for every collection. */
const persistence = createReactNativeSQLitePersistence({ database: db });

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/**
 * Bump this when the shape of persisted data changes in a way that's
 * incompatible with previously persisted rows. Bumping it causes the
 * persistence layer to drop and re-sync all data from the server.
 */
const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// createCollectionFn factory
// ---------------------------------------------------------------------------

/**
 * Returns a `CreateCollectionFn` that wraps the specified collection names
 * with SQLite persistence. Collections not in the set are created normally.
 *
 * @param persistedNames - Set of collection names (keys from the state
 *   definition) that should be persisted to SQLite.
 *
 * @example
 * ```ts
 * const db = createStreamDB({
 *   streamOptions: { url: '...' },
 *   state: stateSchema,
 *   createCollectionFn: createPersistedCollectionFn(
 *     new Set(['projects', 'sessions', 'messages'])
 *   ),
 * });
 * ```
 */
export function createPersistedCollectionFn(
  persistedNames: ReadonlySet<string>,
): CreateCollectionFn {
  return (name: string, config: StreamCollectionConfig): Collection<any, string> => {
    if (persistedNames.has(name)) {
      // persistedCollectionOptions wraps the sync config and returns a new
      // config with persistence plumbing. The `as any` is needed because the
      // wrapped sync param shape includes `metadata` (0.6.0 addition) while
      // our StreamCollectionConfig's SyncConfig comes from the vendored code
      // that predates it. At runtime the persistence layer handles the
      // mismatch gracefully.
      const persisted = persistedCollectionOptions({
        ...config,
        persistence,
        schemaVersion: SCHEMA_VERSION,
      } as any);

      return createCollection(persisted as any) as unknown as Collection<any, string>;
    }

    // Non-persisted collections get the default treatment
    return createCollection(config as any) as unknown as Collection<any, string>;
  };
}
