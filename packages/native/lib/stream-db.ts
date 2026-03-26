export {
  flattenServerMessage,
  stateSchema,
  ephemeralStateSchema,
  appStateSchema,
  unifiedStateDef,
  PERSISTED_COLLECTION_NAMES,
  STATE_STREAM_COLLECTIONS,
  EPHEMERAL_STREAM_COLLECTIONS,
  APP_STREAM_COLLECTIONS,
};
export type {
  ProjectValue,
  SessionValue,
  SessionStatusValue,
  ChangeValue,
  WorktreeStatusValue,
  PermissionRequestValue,
  SessionMetaValue,
  StateDB,
  EphemeralStateDB,
  AppStateDB,
  UnifiedStateDef,
  UnifiedDB,
  UIMessage,
  ToolMeta,
};
export type { ChangedFile, ToolCallStatus } from '../../server/src/types';

import { createStateSchema } from './durable-streams';
import type { StreamDB, MultiStreamDB } from './durable-streams';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Message, ChangedFile } from '../../server/src/types';

function passthrough<T>(): StandardSchemaV1<T> {
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'passthrough',
      validate: (v: unknown) => ({ value: v as T }),
    },
  };
}

type ProjectValue = {
  id: string;
  worktree: string;
  vcsDir?: string;
  vcs?: 'git';
  time: { created: number; initialized?: number };
};

type SessionValue = {
  id: string;
  title: string;
  directory: string;
  projectID: string;
  parentID?: string;
  version: string;
  summary?: { additions: number; deletions: number; files: number };
  share?: { url: string };
  time: { created: number; updated: number };
};

type SessionStatusValue = {
  sessionId: string;
  status: 'idle' | 'busy' | 'error';
  error?: string;
};

type ChangeValue = {
  sessionId: string;
  files: ChangedFile[];
};

type WorktreeStatusValue = {
  sessionId: string;
  isWorktreeSession: boolean;
  branch?: string;
  /** Whether the branch has been merged into main (via --no-ff). */
  merged?: boolean;
  /** Whether there are commits on the branch not yet in main. */
  hasUnmergedCommits?: boolean;
  /** Whether the worktree has staged or unstaged changes. */
  hasUncommittedChanges?: boolean;
  error?: string;
};

type PermissionRequestValue = {
  sessionId: string;
  requestId: string;
  permission: string;
  patterns: string[];
  description: string;
};

const stateDef = {
  projects: {
    schema: passthrough<ProjectValue>(),
    type: 'project' as const,
    primaryKey: 'id' as const,
  },
  sessions: {
    schema: passthrough<SessionValue>(),
    type: 'session' as const,
    primaryKey: 'id' as const,
  },
  messages: { schema: passthrough<Message>(), type: 'message' as const, primaryKey: 'id' as const },
};

type StateDef = typeof stateDef;
type StateDB = StreamDB<StateDef>;

const stateSchema = createStateSchema(stateDef);

// --- Ephemeral state (session status, in-progress messages, worktree status) ---

const ephemeralStateDef = {
  sessionStatuses: {
    schema: passthrough<SessionStatusValue>(),
    type: 'sessionStatus' as const,
    primaryKey: 'sessionId' as const,
  },
  // Renamed from "messages" to "pendingMessages" to avoid collision with the
  // persisted messages collection. The server still sends type: 'message' on
  // the ephemeral stream — the EventDispatcher for the ephemeral stream maps
  // that type to this collection via appendStreamToDb's collectionNames mapping.
  pendingMessages: {
    schema: passthrough<Message>(),
    type: 'message' as const,
    primaryKey: 'id' as const,
  },
  changes: {
    schema: passthrough<ChangeValue>(),
    type: 'change' as const,
    primaryKey: 'sessionId' as const,
  },
  worktreeStatuses: {
    schema: passthrough<WorktreeStatusValue>(),
    type: 'worktreeStatus' as const,
    primaryKey: 'sessionId' as const,
  },
  permissionRequests: {
    schema: passthrough<PermissionRequestValue>(),
    type: 'permissionRequest' as const,
    primaryKey: 'sessionId' as const,
  },
};

type EphemeralStateDef = typeof ephemeralStateDef;
type EphemeralStateDB = StreamDB<EphemeralStateDef>;

const ephemeralStateSchema = createStateSchema(ephemeralStateDef);

// --- Persistent app state (archive status, etc.) ---

type SessionMetaValue = {
  sessionId: string;
  archived: boolean;
};

const appStateDef = {
  sessionMeta: {
    schema: passthrough<SessionMetaValue>(),
    type: 'sessionMeta' as const,
    primaryKey: 'sessionId' as const,
  },
};

type AppStateDef = typeof appStateDef;
type AppStateDB = StreamDB<AppStateDef>;

const appStateSchema = createStateSchema(appStateDef);

// --- Unified state definition (all collections in one DB, fed by multiple streams) ---

/**
 * All collections merged into a single definition. Used with createDbWithNoStreams()
 * to create one DB per backend, then appendStreamToDb() attaches individual streams.
 *
 * Note: `messages` (persisted, from state stream) and `pendingMessages` (ephemeral,
 * from ephemeral stream) are separate collections even though the server sends both
 * as event type 'message'. The per-stream EventDispatcher routes them correctly.
 */
const unifiedStateDef = {
  // From stateDef (state stream — persisted)
  projects: stateDef.projects,
  sessions: stateDef.sessions,
  messages: stateDef.messages,
  // From ephemeralStateDef (ephemeral stream — not persisted)
  sessionStatuses: ephemeralStateDef.sessionStatuses,
  pendingMessages: ephemeralStateDef.pendingMessages,
  changes: ephemeralStateDef.changes,
  worktreeStatuses: ephemeralStateDef.worktreeStatuses,
  permissionRequests: ephemeralStateDef.permissionRequests,
  // From appStateDef (app stream — persisted)
  sessionMeta: appStateDef.sessionMeta,
};

type UnifiedStateDef = typeof unifiedStateDef;

/**
 * A unified DB with all collections from all three streams.
 * This is not a StreamDB (no single stream) — it's a MultiStreamDB.
 */
type UnifiedDB = MultiStreamDB<UnifiedStateDef>;

/**
 * Collection names that should be persisted to SQLite.
 * Ephemeral collections (sessionStatuses, pendingMessages, changes,
 * worktreeStatuses, permissionRequests) are intentionally excluded.
 */
const PERSISTED_COLLECTION_NAMES = new Set([
  'projects',
  'sessions',
  'messages',
  'sessionMeta',
]);

/**
 * Which collections each stream feeds. Used by appendStreamToDb().
 * The key is a label, the value is the list of collection names from
 * unifiedStateDef that this stream's events should route to.
 */
const STATE_STREAM_COLLECTIONS = ['projects', 'sessions', 'messages'] as const;
const EPHEMERAL_STREAM_COLLECTIONS = [
  'sessionStatuses',
  'pendingMessages',
  'changes',
  'worktreeStatuses',
  'permissionRequests',
] as const;
const APP_STREAM_COLLECTIONS = ['sessionMeta'] as const;

// UI types derived from stream state

/** Tool call state passed through to the UI via `toolMeta`. */
type ToolMeta = {
  status: ToolCallStatus;
  input?: Record<string, unknown>;
  output?: string;
  title?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  time?: { start: number; end?: number; compacted?: number };
};

type UIMessage = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  type: 'text' | 'voice' | 'tool_call' | 'status';
  content: string;
  audioUri: string | null;
  transcription: string | null;
  toolName: string | null;
  toolMeta: ToolMeta | null;
  syncStatus: 'synced' | 'pending' | 'sending' | 'failed';
  createdAt: number;
  isComplete: boolean;
};

function flattenServerMessage(msg: Message): UIMessage[] {
  const messages: UIMessage[] = [];
  const isComplete = msg.role === 'user' || !!msg.finish;

  for (const part of msg.parts) {
    switch (part.type) {
      case 'text': {
        const prev = messages[messages.length - 1];
        if (prev && prev.type === 'text' && prev.role === msg.role) {
          prev.content += part.text;
        } else {
          messages.push({
            id: part.id,
            sessionId: msg.sessionId,
            role: msg.role,
            type: 'text',
            content: part.text,
            audioUri: null,
            transcription: null,
            toolName: null,
            toolMeta: null,
            syncStatus: 'synced',
            createdAt: msg.createdAt,
            isComplete,
          });
        }
        break;
      }
      case 'tool':
        messages.push({
          id: part.id,
          sessionId: msg.sessionId,
          role: msg.role,
          type: 'tool_call',
          content: part.state.title || part.state.error || part.tool,
          audioUri: null,
          transcription: null,
          toolName: part.tool,
          toolMeta: part.state as ToolMeta,
          syncStatus: 'synced',
          createdAt: msg.createdAt,
          isComplete,
        });
        break;
    }
  }

  if (messages.length === 0 && msg.parts.length > 0) {
    messages.push({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      type: 'text',
      content: '',
      audioUri: null,
      transcription: null,
      toolName: null,
      toolMeta: null,
      syncStatus: 'synced',
      createdAt: msg.createdAt,
      isComplete,
    });
  }

  return messages;
}
