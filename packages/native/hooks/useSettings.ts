import { useAtom, useAtomValue } from 'jotai';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import {
  notificationSoundAtom,
  connectionInfoAtom,
} from '../state/settings';
import { NOTIFICATION_SOUND_OPTIONS } from '../__fixtures__/settings';
import {
  backendsAtom,
  backendConnectionsAtom,
  type BackendConfig,
  type BackendConnection,
} from '../state/backends';


export function useSettings() {
  const [backends, setBackends] = useAtom(backendsAtom);
  const resolvedBackends = backends instanceof Promise ? [] : backends;
  const connections = useAtomValue(backendConnectionsAtom);
  const [notificationSound, setNotificationSound] = useAtom(notificationSoundAtom);

  // Aggregate connection info across all backends
  const connection = useAtomValue(connectionInfoAtom);

  // Build version string from real app version + OTA update ID when available
  const nativeVersion = Constants.expoConfig?.version ?? '0.0.0';
  const updateId = Updates.updateId;
  const appVersion = updateId
    ? `${nativeVersion} (${updateId.slice(0, 8)})`
    : nativeVersion;

  const isEmergencyLaunch = Updates.isEmergencyLaunch;

  return {
    connection,

    // Multi-backend API
    backends: resolvedBackends,
    setBackends,
    connections,

    // Voice settings
    notificationSound,
    setNotificationSound,
    notificationSoundOptions: NOTIFICATION_SOUND_OPTIONS,

    // App info
    appVersion,
    isEmergencyLaunch,
  };
}
