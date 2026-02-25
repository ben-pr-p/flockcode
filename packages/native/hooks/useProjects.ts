import { useAtomValue } from 'jotai';
import { apiAtom } from '../lib/api';
import { useRpcTarget } from './useRpcTarget';
import type { Project } from '../../server/src/types';

export type { Project };

export function useProjects() {
  const api = useAtomValue(apiAtom);

  const { data, isLoading } = useRpcTarget(() => api.projectList(), [api]);

  return {
    data: data ?? [],
    isLoading,
    error: null as Error | null,
  };
}
