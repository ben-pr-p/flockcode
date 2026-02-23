import { useState } from 'react'
import { useAtom } from 'jotai'
import {
  serverUrlAtom,
  handsFreeAutoRecordAtom,
  notificationSoundAtom,
} from '../state/settings'
import {
  FIXTURE_SETTINGS,
  NOTIFICATION_SOUND_OPTIONS,
  type ConnectionInfo,
} from '../__fixtures__/settings'

export function useSettings() {
  const [serverUrl, setServerUrl] = useAtom(serverUrlAtom)
  const [handsFreeAutoRecord, setHandsFreeAutoRecord] = useAtom(handsFreeAutoRecordAtom)
  const [notificationSound, setNotificationSound] = useAtom(notificationSoundAtom)

  // TODO: Replace with real connection monitoring
  const connection: ConnectionInfo = FIXTURE_SETTINGS.connection

  return {
    serverUrl,
    setServerUrl,
    connection,
    handsFreeAutoRecord,
    setHandsFreeAutoRecord,
    notificationSound,
    setNotificationSound,
    notificationSoundOptions: NOTIFICATION_SOUND_OPTIONS,
    appVersion: FIXTURE_SETTINGS.appVersion,
    defaultModel: FIXTURE_SETTINGS.defaultModel,
  }
}
