import { useEffect, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  selectedModelAtom,
  modelCatalogAtom,
  modelDefaultsAtom,
  type ModelSelection,
  type CatalogModel,
} from '../state/settings';
import { backendResourcesAtom } from '../lib/backend-streams';
import { backendConnectionsAtom, type BackendUrl } from '../state/backends';
import type { ApiClient } from '../lib/api';

/**
 * Fetches the provider/model catalog from the server and exposes model
 * selection state.
 *
 * Accepts an optional `backendUrl` to fetch from a specific backend.
 * If omitted, fetches from all connected backends and merges the catalogs.
 */
export function useModels(backendUrl: BackendUrl) {
  const resources = useAtomValue(backendResourcesAtom);
  const connections = useAtomValue(backendConnectionsAtom);
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);
  const setCatalog = useSetAtom(modelCatalogAtom);
  const setDefaults = useSetAtom(modelDefaultsAtom);
  const catalog = useAtomValue(modelCatalogAtom);
  const defaults = useAtomValue(modelDefaultsAtom);

  const fetchCatalog = useCallback(async () => {
    // Determine which backends to fetch from
    const apis: ApiClient[] = backendUrl
      ? [resources[backendUrl]?.api].filter((a): a is ApiClient => a != null)
      : Object.values(resources)
          .filter((r) => r.api != null)
          .map((r) => r.api!);

    if (apis.length === 0) return;

    const allModels: CatalogModel[] = [];
    let mergedDefaults: Record<string, string> = {};

    for (const api of apis) {
      try {
        const res = await (api.api as any).models.$get();
        if (!res.ok) continue;
        const data = await res.json();

        const connectedSet = new Set(data.connected ?? []);

        for (const provider of data.all ?? []) {
          if (!connectedSet.has(provider.id)) continue;

          for (const [modelId, model] of Object.entries(provider.models ?? {})) {
            const m = model as any;
            // Dedup by providerID + modelID
            if (
              !allModels.some(
                (existing) => existing.id === modelId && existing.providerID === provider.id
              )
            ) {
              allModels.push({
                id: modelId,
                name: m.name ?? modelId,
                providerID: provider.id,
                providerName: provider.name ?? provider.id,
                status: m.status,
              });
            }
          }
        }

        // Merge defaults — last one wins
        mergedDefaults = { ...mergedDefaults, ...(data.default ?? {}) };
      } catch (err) {
        console.error('[useModels] Failed to fetch model catalog:', err);
      }
    }

    setCatalog(allModels);
    setDefaults(mergedDefaults);
  }, [resources, backendUrl, setCatalog, setDefaults]);

  // Fetch catalog when any backend connects
  const connectionValues = Object.values(connections);
  const anyConnected = connectionValues.some((c) => c.status === 'connected');
  useEffect(() => {
    if (!anyConnected) return;
    fetchCatalog();
  }, [anyConnected, fetchCatalog]);

  const getDisplayNames = useCallback(
    (modelID?: string, providerID?: string): { modelName: string; providerName: string } => {
      if (!modelID || !catalog) {
        return { modelName: modelID ?? 'Default', providerName: providerID ?? '' };
      }
      const match = catalog.find((m) => m.id === modelID && m.providerID === providerID);
      if (match) {
        return { modelName: match.name, providerName: match.providerName };
      }
      const byModel = catalog.find((m) => m.id === modelID);
      if (byModel) {
        return { modelName: byModel.name, providerName: byModel.providerName };
      }
      return {
        modelName: prettifyModelId(modelID),
        providerName: providerID ?? '',
      };
    },
    [catalog]
  );

  const getDefaultModel = useCallback((): ModelSelection | null => {
    const defaultStr = defaults[''];
    if (!defaultStr) return null;
    const slashIdx = defaultStr.indexOf('/');
    if (slashIdx < 0) return null;
    return {
      providerID: defaultStr.slice(0, slashIdx),
      modelID: defaultStr.slice(slashIdx + 1),
    };
  }, [defaults]);

  return {
    selectedModel,
    setSelectedModel,
    catalog,
    defaults,
    getDisplayNames,
    getDefaultModel,
    refetchCatalog: fetchCatalog,
  };
}

/** Convert a raw model ID like "claude-sonnet-4-20250514" to "Claude Sonnet 4" */
function prettifyModelId(modelId: string): string {
  const withoutDate = modelId.replace(/-\d{8}$/, '');
  return withoutDate
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
