export type NotificationSound = 'chime' | 'bell' | 'ping' | 'none'

export interface ConnectionInfo {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error'
  latencyMs: number | null
  error: string | null
}

export const NOTIFICATION_SOUND_OPTIONS: { label: string; value: NotificationSound }[] = [
  { label: 'Chime (default)', value: 'chime' },
  { label: 'Bell', value: 'bell' },
  { label: 'Ping', value: 'ping' },
  { label: 'None', value: 'none' },
]
