/**
 * Core notification send logic.
 * Uses FCM HTTP v1 REST API (no firebase-admin SDK).
 * SERVER-ONLY — never import from client components.
 */

import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, notifications } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import {
  sendMulticastNotification,
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

export async function sendNotificationCore(
  userId:    string,
  projectId: string,
  title:     string,
  body:      string
): Promise<SendResult> {
  const db = await getDb()

  // ── 1. Verify project ownership ──────────────────────────────────────────
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.userId !== userId) {
    return { success: false, error: 'Project not found' }
  }

  if (!project.firebaseJsonPath) {
    return {
      success: false,
      error:   'No Firebase credentials configured for this project',
    }
  }

  // ── 2. Download Firebase JSON from R2 ────────────────────────────────────
  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    console.error('[Send] R2 download failed for key:', project.firebaseJsonPath)
    return { success: false, error: 'Failed to load Firebase credentials from storage' }
  }

  let credentials: FirebaseCredentials
  try {
    const parsed = JSON.parse(fileContent) as Record<string, unknown>
    const validation = validateFirebaseCredentials(parsed)
    if (!validation.valid) {
      return { success: false, error: `Invalid Firebase credentials: ${validation.error}` }
    }
    credentials = parsed as FirebaseCredentials
  } catch {
    return { success: false, error: 'Firebase credentials file is not valid JSON' }
  }

  // ── 3. Fetch all FCM tokens for this project ──────────────────────────────
  const deviceRows = await db
    .select({ fcmToken: devices.fcmToken })
    .from(devices)
    .where(eq(devices.projectId, projectId))

  const tokens = deviceRows.map((d) => d.fcmToken).filter(Boolean)

  // ── 4. Insert notification record as "pending" ────────────────────────────
  const notificationId = generateSecureToken(16)
  await db.insert(notifications).values({
    id:             notificationId,
    projectId,
    title,
    body,
    status:         'pending',
    recipientCount: tokens.length,
  })

  // ── 5. Send via FCM HTTP v1 REST API ─────────────────────────────────────
  let successCount = 0
  let failureCount = 0
  let finalStatus: 'sent' | 'failed' = 'failed'

  try {
    const result = await sendMulticastNotification(credentials, tokens, title, body)
    successCount = result.successCount
    failureCount = result.failureCount
    finalStatus  = successCount > 0 || tokens.length === 0 ? 'sent' : 'failed'

    // ── 5a. Auto-cleanup dead tokens (app uninstalled) ────────────────────
    if (result.deadTokens.length > 0) {
      console.log(`[Send] Removing ${result.deadTokens.length} dead token(s) from DB`)
      await db
        .delete(devices)
        .where(inArray(devices.fcmToken, result.deadTokens))
    }
  } catch (err) {
    console.error('[Send] FCM error:', err)
    failureCount = tokens.length
    return {
      success: false,
      error:   err instanceof Error ? err.message : 'FCM send failed',
    }
  }

  // ── 6. Update notification record with final status ───────────────────────
  await db
    .update(notifications)
    .set({
      status:         finalStatus,
      sentAt:         new Date().toISOString(),
      recipientCount: successCount,
    })
    .where(eq(notifications.id, notificationId))

  return {
    success:        true,
    notificationId,
    recipientCount: successCount,
    failureCount,
    status:         finalStatus,
  }
}
