import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { commandCatalogAtom, type CommandInfo } from '../state/settings';
import { backendResourcesAtom } from '../lib/backend-streams';
import { backendConnectionsAtom, type BackendUrl } from '../state/backends';

/**
 * Fetches the command catalog from a specific backend and exposes command state.
 * The catalog is re-fetched whenever the backend transitions to 'connected'.
 */
export function useCommands(backendUrl: BackendUrl) {
  const resources = useAtomValue(backendResourcesAtom);
  const connections = useAtomValue(backendConnectionsAtom);
  const setCatalog = useSetAtom(commandCatalogAtom);
  const catalog = useAtomValue(commandCatalogAtom);

  const api = resources[backendUrl]?.api ?? null;
  const connectionStatus = connections[backendUrl]?.status ?? 'reconnecting';

  const fetchCommands = useCallback(async () => {
    if (!api) return;
    try {
      const commands = await api.commands.list();

      setCatalog(commands);
    } catch (err) {
      console.error('[useCommands] Failed to fetch command catalog:', err);
    }
  }, [api, setCatalog]);

  // Fetch catalog when backend becomes connected
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    fetchCommands();
  }, [connectionStatus, fetchCommands]);

  return {
    commands: catalog,
    refetchCommands: fetchCommands,
  };
}
