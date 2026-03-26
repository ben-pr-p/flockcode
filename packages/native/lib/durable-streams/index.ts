/**
 * Vendored durable-streams state module.
 *
 * Copied from @durable-streams/state so we can modify the StreamDB
 * internals (persistence, BYOC collections, stream reconnection).
 */

// Types
export type {
  Operation,
  Value,
  Row,
  ChangeHeaders,
  ChangeEvent,
  ControlEvent,
  StateEvent,
} from './types';

export { isChangeEvent, isControlEvent } from './types';

// Stream DB (original single-stream API)
export { createStreamDB, createStateSchema } from './stream-db';
export type {
  CollectionDefinition,
  CollectionEventHelpers,
  CollectionWithHelpers,
  StreamStateDefinition,
  StateSchema,
  CreateStreamDBOptions,
  StreamCollectionConfig,
  CreateCollectionFn,
  StreamDB,
  StreamDBMethods,
  StreamDBUtils,
  StreamDBWithActions,
  ActionFactory,
  ActionMap,
  ActionDefinition,
} from './stream-db';

// Multi-stream DB (create once, attach multiple streams)
export { createDbWithNoStreams, appendStreamToDb } from './stream-db';
export type {
  MultiStreamDB,
  CreateDbWithNoStreamsOptions,
  AppendStreamOptions,
  StreamHandle,
} from './stream-db';

// Re-export key types from @tanstack/db for convenience
export type { Collection, SyncConfig } from '@tanstack/db';
