/**
 * Core notification send logic.
 * Supports sending to:
 *   - 'all'                     → all devices (via topic all_{appId})
 *   - 'android' | 'ios' etc     → platform topic
 *   - 'topic:{topicName}'       → custom topic
 *   - 'tokens'                  → individual token loop (fallback)
 */

import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, notifications } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import {
  sendMulticastNotification,
  sendToTopic,
  validateFirebaseCredentials,
  type FirebaseCredentials,
} from '@/lib/firebase/admin'
import { generateSecureToken } from '@/lib/utils'

export interface SendResult {
  success:         boolean
  notificationId?: string
  recipientCount?: number
  failureCount?:   number
  status?:         'sent' | 'failed'
  error?:          string
}

/**
 * @param target  'all' | 'android' | 'ios' | 'flutter' | 'react-native'
 *                | 'topic:{name}' | 'tokens'
 */
export async function sendNotificationCore(
  userId:    string,
  projectId: string,
  title:     string,
  body:      string,
  target:    string = 'all'
): Promise<SendResult> {
  const db = await getDb()

  // ── 1. Verify project ownership ───────────────────────────────────────────
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

  // ── 2. Load Firebase credentials from R2 ─────────────────────────────────
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

  // ── 3. Create notification record ─────────────────────────────────────────
  const notificationId = generateSecureToken(16)
  await db.insert(notifications).values({
    id: notificationId, projectId, title, body,
    target, status: 'pending', recipientCount: 0,
  })

  // ── 4. Send ───────────────────────────────────────────────────────────────
  let successCount = 0
  let failureCount = 0
  let finalStatus: 'sent' | 'failed' = 'failed'

  try {
    if (target === 'tokens') {
      // Explicit token-based send
      const deviceRows = await db
        .select({ fcmToken: devices.fcmToken })
        .from(devices)
        .where(eq(devices.projectId, projectId))
      const tokens = deviceRows.map((d) => d.fcmToken).filter(Boolean)

      const result = await sendMulticastNotification(credentials, tokens, title, body)
      successCount = result.successCount
      failureCount = result.failureCount
      finalStatus  = successCount > 0 || tokens.length === 0 ? 'sent' : 'failed'

      if (result.deadTokens.length > 0) {
        await db.delete(devices).where(inArray(devices.fcmToken, result.deadTokens))
      }
    } else if (target.startsWith('topic:')) {
      // Custom topic — Flutter subscribes directly via Firebase SDK
      // Topic name is exactly as user subscribed (no suffix needed)
      const topicName = target.replace('topic:', '')

      const result = await sendToTopic(credentials, topicName, title, body)
      successCount = result.success ? 1 : 0
      failureCount = result.success ? 0 : 1
      finalStatus  = result.success ? 'sent' : 'failed'
    } else {
      // 'all' | 'android' | 'ios' | 'flutter' | 'react-native'
      // Use direct token send — reliable without requiring topic subscriptions
      const deviceRows = await db
        .select({ fcmToken: devices.fcmToken, platform: devices.platform })
        .from(devices)
        .where(eq(devices.projectId, projectId))

      let filteredTokens = deviceRows
        .map((d) => ({ token: d.fcmToken, platform: d.platform }))
        .filter((d) => d.token)

      // Filter by platform if not 'all'
      if (target !== 'all') {
        filteredTokens = filteredTokens.filter((d) => d.platform === target)
      }

      const tokens = filteredTokens.map((d) => d.token)

      const result = await sendMulticastNotification(credentials, tokens, title, body)
      successCount = result.successCount
      failureCount = result.failureCount
      finalStatus  = successCount > 0 || tokens.length === 0 ? 'sent' : 'failed'

      if (result.deadTokens.length > 0) {
        await db.delete(devices).where(inArray(devices.fcmToken, result.deadTokens))
      }
    }
  } catch (err) {
    console.error('[Send] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Send failed',
    }
  }

  // ── 5. Update notification record ─────────────────────────────────────────
  await db
    .update(notifications)
    .set({ status: finalStatus, sentAt: new Date().toISOString(), recipientCount: successCount })
    .where(eq(notifications.id, notificationId))

  return { success: true, notificationId, recipientCount: successCount, failureCount, status: finalStatus }
}
