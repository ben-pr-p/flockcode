import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { agentCatalogAtom, connectionInfoAtom, type AgentInfo } from '../state/settings';
import { backendResourcesAtom } from '../lib/backend-streams';
import { backendConnectionsAtom, type BackendUrl } from '../state/backends';

/**
 * Fetches the agent catalog from a specific backend and exposes agent state.
 * The catalog is re-fetched whenever the backend transitions to 'connected'.
 */
export function useAgents(backendUrl: BackendUrl) {
  const resources = useAtomValue(backendResourcesAtom);
  const connections = useAtomValue(backendConnectionsAtom);
  const setCatalog = useSetAtom(agentCatalogAtom);
  const catalog = useAtomValue(agentCatalogAtom);

  const api = resources[backendUrl]?.api ?? null;
  const connectionStatus = connections[backendUrl]?.status ?? 'reconnecting';

  const fetchAgents = useCallback(async () => {
    if (!api) return;
    try {
      const res = await (api.api as any).agents.$get();
      if (!res.ok) return;
      const data = await res.json();

      // The server returns an object keyed by agent name, each value has
      // name, description, mode, color, etc.
      const agents: AgentInfo[] = [];
      if (data && typeof data === 'object') {
        // Handle both array and object (keyed by name) response shapes
        if (Array.isArray(data)) {
          for (const agent of data) {
            agents.push({
              name: agent.name ?? '',
              description: agent.description,
              mode: agent.mode ?? 'primary',
              color: agent.color,
            });
          }
        } else {
          for (const [key, value] of Object.entries(data)) {
            const agent = value as any;
            agents.push({
              name: agent.name ?? key,
              description: agent.description,
              mode: agent.mode ?? 'primary',
              color: agent.color,
            });
          }
        }
      }

      setCatalog(agents);
    } catch (err) {
      console.error('[useAgents] Failed to fetch agent catalog:', err);
    }
  }, [api, setCatalog]);

  // Fetch catalog when backend becomes connected
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    fetchAgents();
  }, [connectionStatus, fetchAgents]);

  // Only show primary agents in the selector (subagents are invoked by the model)
  const primaryAgents = catalog?.filter((a) => a.mode === 'primary' || a.mode === 'all') ?? null;

  return {
    agents: catalog,
    primaryAgents,
    refetchAgents: fetchAgents,
  };
}
