/**
 * Re-export Drizzle-inferred types as the canonical types for the app.
 * All components and actions should import from here.
 */
export type {
  User,
  NewUser,
  Project,
  NewProject,
  Device,
  NewDevice,
  Notification,
  NewNotification,
} from '@/lib/db/schema'

// ── API types ─────────────────────────────────────────────────────────────────

export interface DeviceRegisterRequest {
  appId:      string
  apiKey:     string
  fcmToken:   string
  platform:   'android' | 'ios' | 'flutter' | 'react-native'
  appVersion?: string
  deviceId:   string
}

export interface SendNotificationRequest {
  projectId: string
  title:     string
  body:      string
}

export interface ApiResponse<T = undefined> {
  success:  boolean
  message?: string
  data?:    T
  error?:   string
}
