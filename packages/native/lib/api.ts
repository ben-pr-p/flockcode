// Hono RPC client — type-safe API calls inferred from the server's route types.

import { atom } from 'jotai';
import { hc } from 'hono/client';
import type { AppType } from '../../server/src/app';
import { debouncedServerUrlAtom } from '../state/settings';

export type ApiClient = ReturnType<typeof hc<AppType>>;

export const apiClientAtom = atom<ApiClient>((get) => {
  const serverUrl = get(debouncedServerUrlAtom).replace(/\/$/, '');
  return hc<AppType>(serverUrl);
});
