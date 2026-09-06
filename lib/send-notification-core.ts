/**
 * Core notification send — OneSignal-style FCM topic fan-out.
 *
 * Broadcasts (all / OS / country / version / named topic) → one FCM topic call.
 * Segments and explicit token lists still walk D1.
 */

import { eq, and, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, notifications, topics, deviceTopics } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import {
  sendMulticastNotification,
  sendToTopic,
  validateFirebaseCredentials,
  type FirebaseCredentials,
} from '@/lib/firebase/admin'
import { generateSecureToken } from '@/lib/utils'
import { resolveAudienceTarget } from '@/lib/utils/topic-normalizer'
import { querySegmentDeviceTokens } from '@/lib/services/segment-service'

export interface SendResult {
  success:         boolean
  notificationId?: string
  recipientCount?: number
  failureCount?:   number
  status?:         'sent' | 'failed'
  error?:          string
}

export interface SendNotificationOptions {
  url?: string
  imageUrl?: string
  data?: Record<string, string>
}

async function estimateTopicSubscribers(projectId: string, topicName: string): Promise<number> {
  const db = await getDb()
  const [topicRow] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, projectId), eq(topics.name, topicName)))
    .limit(1)

  if (!topicRow) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(devices)
      .where(and(eq(devices.projectId, projectId), eq(devices.status, 'active')))
    return Number(row?.n ?? 0)
  }

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(deviceTopics)
    .where(eq(deviceTopics.topicId, topicRow.id))
  return Number(row?.n ?? 0)
}

/**
 * @param target  'all' | 'android' | 'ios' | 'version:2' | 'country:IN'
 *                | 'topic:{name}' | 'segment:{id}' | 'tokens'
 */
export async function sendNotificationCore(
  userId:    string,
  projectId: string,
  title:     string,
  body:      string,
  target:    string = 'all',
  options?:  SendNotificationOptions
): Promise<SendResult> {
  const db = await getDb()

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) {
    return { success: false, error: 'Project not found' }
  }

  if (!project.firebaseJsonPath) {
    return { success: false, error: 'No Firebase credentials configured for this project' }
  }

  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    return { success: false, error: 'Failed to load Firebase credentials from storage' }
  }

  let credentials: FirebaseCredentials
  try {
    const parsed     = JSON.parse(fileContent) as Record<string, unknown>
    const validation = validateFirebaseCredentials(parsed)
    if (!validation.valid) return { success: false, error: `Invalid Firebase credentials: ${validation.error}` }
    credentials = parsed as FirebaseCredentials
  } catch {
    return { success: false, error: 'Firebase credentials file is not valid JSON' }
  }

  const audience = resolveAudienceTarget(project.appId, target)
  const notificationId = generateSecureToken(16)
  const targetType =
    audience.kind === 'segment' ? 'segment' :
    audience.kind === 'user' ? 'device' : 'topic'
  const targetValue =
    audience.kind === 'topic' ? audience.topic :
    audience.kind === 'segment' ? audience.segmentId :
    audience.kind === 'user' ? audience.userId :
    target

  await db.insert(notifications).values({
    id: notificationId,
    projectId,
    name: title,
    title,
    body,
    url: options?.url ?? null,
    imageUrl: options?.imageUrl ?? null,
    target,
    targetType,
    targetValue,
    status: 'pending',
    recipientCount: 0,
  })

  const fcmSendOptions = {
    url: options?.url,
    imageUrl: options?.imageUrl,
    data: options?.data,
  }

  let successCount = 0
  let failureCount = 0
  let finalStatus: 'completed' | 'failed' = 'failed'

  try {
    if (audience.kind === 'topic') {
      const result = await sendToTopic(
        credentials,
        audience.topic,
        title,
        body,
        fcmSendOptions,
      )
      if (!result.success) {
        await db.update(notifications)
          .set({ status: 'failed', sentAt: new Date().toISOString() })
          .where(eq(notifications.id, notificationId))
        return { success: false, error: result.error || 'FCM topic send failed', notificationId }
      }
      successCount = await estimateTopicSubscribers(projectId, audience.topic)
      finalStatus = 'completed'
    } else if (audience.kind === 'segment') {
      const targetDevices = await querySegmentDeviceTokens(projectId, audience.segmentId)
      const tokens = targetDevices.map((d) => d.fcmToken).filter(Boolean)
      const result = await sendMulticastNotification(credentials, tokens, title, body, fcmSendOptions)
      successCount = result.successCount
      failureCount = result.failureCount
      finalStatus  = successCount > 0 || tokens.length === 0 ? 'completed' : 'failed'
      if (result.deadTokens.length > 0) {
        await db
          .update(devices)
          .set({ status: 'inactive', inactiveAt: new Date().toISOString() })
          .where(inArray(devices.fcmToken, result.deadTokens))
      }
    } else if (audience.kind === 'user') {
      if (!audience.userId) {
        return { success: false, error: 'User id is required' }
      }
      const deviceRows = await db
        .select({ fcmToken: devices.fcmToken })
        .from(devices)
        .where(and(
          eq(devices.projectId, projectId),
          eq(devices.externalUserId, audience.userId),
        ))
      const tokens = deviceRows.map((d) => d.fcmToken).filter(Boolean)
      const result = await sendMulticastNotification(credentials, tokens, title, body, fcmSendOptions)
      successCount = result.successCount
      failureCount = result.failureCount
      finalStatus  = successCount > 0 || tokens.length === 0 ? 'completed' : 'failed'
    } else {
      const deviceRows = await db
        .select({ fcmToken: devices.fcmToken })
        .from(devices)
        .where(eq(devices.projectId, projectId))
      const tokens = deviceRows.map((d) => d.fcmToken).filter(Boolean)
      const result = await sendMulticastNotification(credentials, tokens, title, body, fcmSendOptions)
      successCount = result.successCount
      failureCount = result.failureCount
      finalStatus  = successCount > 0 || tokens.length === 0 ? 'completed' : 'failed'
    }
  } catch (err) {
    console.error('[Send] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Send failed',
    }
  }

  await db
    .update(notifications)
    .set({ status: finalStatus, sentAt: new Date().toISOString(), recipientCount: successCount })
    .where(eq(notifications.id, notificationId))

  return {
    success: true,
    notificationId,
    recipientCount: successCount,
    failureCount,
    status: finalStatus === 'completed' ? 'sent' : 'failed',
  }
}
