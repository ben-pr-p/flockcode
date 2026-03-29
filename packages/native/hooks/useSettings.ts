import { useAtom } from 'jotai';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { notificationSoundAtom } from '../state/settings';
import { NOTIFICATION_SOUND_OPTIONS } from '../__fixtures__/settings';

export function useSettings() {
  const [notificationSound, setNotificationSound] = useAtom(notificationSoundAtom);

  const nativeVersion = Constants.expoConfig?.version ?? '0.0.0';
  const updateId = Updates.updateId;
  const appVersion = updateId ? `${nativeVersion} (${updateId.slice(0, 8)})` : nativeVersion;

  const isEmergencyLaunch = Updates.isEmergencyLaunch;

  return {
    notificationSound,
    setNotificationSound,
    notificationSoundOptions: NOTIFICATION_SOUND_OPTIONS,
    appVersion,
    isEmergencyLaunch,
  };
}
