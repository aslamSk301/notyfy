// ============================================================
// Shared TypeScript types for NotifyMVP
// ============================================================

export interface Project {
  id: string
  user_id: string
  name: string
  app_id: string
  api_key: string
  firebase_json_path: string | null
  created_at: string
}

export interface Device {
  id: string
  project_id: string
  device_id: string
  fcm_token: string
  platform: 'android' | 'ios' | 'flutter' | 'react-native'
  app_version: string | null
  created_at: string
}

export interface Notification {
  id: string
  project_id: string
  title: string
  body: string
  status: 'pending' | 'sent' | 'failed'
  recipient_count: number
  sent_at: string | null
  created_at: string
}

// ============================================================
// API Request / Response types
// ============================================================

export interface DeviceRegisterRequest {
  appId: string
  apiKey: string
  fcmToken: string
  platform: 'android' | 'ios' | 'flutter' | 'react-native'
  appVersion?: string
  deviceId: string
}

export interface SendNotificationRequest {
  projectId: string
  title: string
  body: string
}

export interface ApiResponse<T = undefined> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

// ============================================================
// Form types
// ============================================================

export interface CreateProjectFormValues {
  name: string
  firebaseJson?: FileList
}

export interface SendNotificationFormValues {
  projectId: string
  title: string
  body: string
}

export interface LoginFormValues {
  email: string
  password: string
}

export interface RegisterFormValues {
  email: string
  password: string
  confirmPassword: string
}
