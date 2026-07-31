/**
 * Core notification send logic — used by both the Server Action and API route.
 * Replaces Supabase admin client with Drizzle + D1 + R2.
 * SERVER-ONLY — never import from client components.
 */

import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, notifications } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import { getFirebaseApp, sendMulticastNotification } from '@/lib/firebase/admin'
import { generateSecureToken } from '@/lib/utils'

export interface SendResult {
  success:        boolean
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
    return { success: false, error: 'No Firebase credentials configured for this project' }
  }

  // ── 2. Download Firebase JSON from R2 ────────────────────────────────────
  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    console.error('[Send] R2 download failed for key:', project.firebaseJsonPath)
    return { success: false, error: 'Failed to load Firebase credentials from storage' }
  }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(fileContent)
  } catch {
    return { success: false, error: 'Firebase credentials file is not valid JSON' }
  }

  // ── 3. Initialize per-project Firebase Admin app ──────────────────────────
  let firebaseApp
  try {
    firebaseApp = getFirebaseApp(
      projectId,
      credentials as Parameters<typeof getFirebaseApp>[1]
    )
  } catch (err) {
    console.error('[Send] Firebase init error:', err)
    return { success: false, error: 'Failed to initialize Firebase Admin SDK' }
  }

  // ── 4. Fetch all FCM tokens for this project ──────────────────────────────
  const deviceRows = await db
    .select({ fcmToken: devices.fcmToken })
    .from(devices)
    .where(eq(devices.projectId, projectId))

  const tokens = deviceRows.map((d) => d.fcmToken).filter(Boolean)

  // ── 5. Insert notification record as "pending" ────────────────────────────
  const notificationId = generateSecureToken(16)
  await db.insert(notifications).values({
    id:             notificationId,
    projectId,
    title,
    body,
    status:         'pending',
    recipientCount: tokens.length,
  })

  // ── 6. Send FCM multicast ─────────────────────────────────────────────────
  let successCount = 0
  let failureCount = 0
  let finalStatus: 'sent' | 'failed' = 'failed'

  try {
    const result = await sendMulticastNotification(firebaseApp, tokens, title, body)
    successCount = result.successCount
    failureCount = result.failureCount
    finalStatus  = successCount > 0 || tokens.length === 0 ? 'sent' : 'failed'

    // ── 6a. Auto-cleanup dead tokens (app uninstalled) ────────────────────
    if (result.deadTokens.length > 0) {
      console.log(`[Send] Removing ${result.deadTokens.length} dead token(s)`)
      await db
        .delete(devices)
        .where(inArray(devices.fcmToken, result.deadTokens))
    }
  } catch (err) {
    console.error('[Send] FCM error:', err)
    failureCount = tokens.length
  }

  // ── 7. Update notification record with final status ───────────────────────
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
