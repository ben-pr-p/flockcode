// Hono RPC client — type-safe API calls inferred from the server's route types.

import { hc } from 'hono/client';
import type { AppType } from '../../server/src/app';

/** Type-safe Hono RPC client for one backend server. */
export type ApiClient = ReturnType<typeof hc<AppType>>;
