/**
 * TypeScript types for OneSignal-grade Push Notification Architecture
 */

export type PlatformType = 'android' | 'ios'
export type SubscriptionStatus = 'active' | 'inactive'
export type NotificationPermission = 'granted' | 'denied' | 'default'

export interface RegisterDeviceInput {
  appId:                  string
  apiKey:                 string
  fcmToken:               string
  platform:               PlatformType
  deviceId:               string
  userId?:                string
  country?:               string
  language?:              string
  appVersion?:            string
  osVersion?:             string
  deviceModel?:           string
  notificationPermission?: NotificationPermission
}

export interface UpdateDeviceInput {
  appId:                  string
  apiKey:                 string
  deviceId:               string
  userId?:                string
  country?:               string
  language?:              string
  appVersion?:            string
  osVersion?:             string
  deviceModel?:           string
  notificationPermission?: NotificationPermission
  status?:                SubscriptionStatus
}

export interface UpdateDeviceTokenInput {
  appId:    string
  apiKey:   string
  deviceId: string
  fcmToken: string
}

export interface DeviceHeartbeatInput {
  appId:    string
  apiKey:   string
  deviceId: string
}

export interface TopicConfig {
  name:        string
  type:        'system' | 'custom'
  description?: string
  isActive:    boolean
}

export interface SystemTopics {
  allUsers:    string // "all_users"
  country?:    string // "country_in"
  language?:   string // "language_en"
  os?:         string // "os_android"
  appVersion?: string // "version_2_0_0"
}

export type CampaignTargetType = 'topic' | 'device' | 'segment'
export type CampaignStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled'
export type PriorityType = 'high' | 'normal'

export interface CreateCampaignInput {
  projectId:   string
  name:        string
  title:       string
  body:        string
  image?:      string
  icon?:       string
  badge?:      number
  sound?:      string
  deepLink?:   string
  clickAction?: string
  priority?:   PriorityType
  ttl?:        number
  channelId?:  string
  data?:       Record<string, unknown>
  targetType:  CampaignTargetType
  targetValue: string
}

export interface SegmentRuleInput {
  field:    'country' | 'language' | 'platform' | 'osVersion' | 'appVersion' | 'notificationPermission' | 'status' | 'lastOpen' | 'userId'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in'
  value:    string
}

export interface CreateSegmentInput {
  projectId:   string
  name:        string
  description?: string
  rules:       SegmentRuleInput[]
}

export interface FcmPayload {
  token?:   string
  topic?:   string
  title:    string
  body:     string
  image?:   string
  icon?:    string
  badge?:   number
  sound?:   string
  deepLink?: string
  clickAction?: string
  channelId?: string
  data?:    Record<string, string>
  priority?: PriorityType
  ttl?:     number
}

export interface FcmResponse {
  success:     boolean
  messageId?:  string
  error?:      string
  errorCode?:  string
  isPermanent?: boolean
}

export interface SubscriptionAnalytics {
  totalSubscriptions:    number
  activeSubscriptions:   number
  inactiveSubscriptions: number
}
