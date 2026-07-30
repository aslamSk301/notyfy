/**
 * Core notification send logic — shared between the Server Action and the API route.
 * Runs entirely server-side. Never import from client components.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getFirebaseApp, sendMulticastNotification } from '@/lib/firebase/admin'

export interface SendResult {
  success: boolean
  notificationId?: string
  recipientCount?: number
  failureCount?: number
  status?: 'sent' | 'failed'
  error?: string
}

export async function sendNotificationCore(
  userId: string,
  projectId: string,
  title: string,
  body: string
): Promise<SendResult> {
  const adminClient = createAdminClient()

  // ── 1. Verify project ownership ──────────────────────────────────────────
  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('id, firebase_json_path')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  if (!project.firebase_json_path) {
    return { success: false, error: 'No Firebase credentials configured for this project' }
  }

  // ── 2. Download Firebase JSON from private Supabase Storage ──────────────
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from('firebase-credentials')
    .download(project.firebase_json_path)

  if (downloadError || !fileData) {
    console.error('[Send] Storage download error:', downloadError)
    return { success: false, error: 'Failed to load Firebase credentials from storage' }
  }

  let credentials: Record<string, unknown>
  try {
    const text = await fileData.text()
    credentials = JSON.parse(text)
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
  const { data: devices, error: devicesError } = await adminClient
    .from('devices')
    .select('fcm_token')
    .eq('project_id', projectId)

  if (devicesError) {
    return { success: false, error: 'Failed to fetch registered devices' }
  }

  const tokens = (devices ?? [])
    .map((d: { fcm_token: string }) => d.fcm_token)
    .filter(Boolean)

  // ── 5. Insert notification record as "pending" ────────────────────────────
  const { data: notifRecord, error: insertError } = await adminClient
    .from('notifications')
    .insert({
      project_id: projectId,
      title,
      body,
      status: 'pending',
      recipient_count: tokens.length,
    })
    .select()
    .single()

  if (insertError || !notifRecord) {
    console.error('[Send] Insert error:', insertError)
    return { success: false, error: 'Failed to create notification record' }
  }

  // ── 6. Send multicast push via Firebase ──────────────────────────────────
  let successCount = 0
  let failureCount = 0
  let finalStatus: 'sent' | 'failed' = 'failed'

  try {
    const result = await sendMulticastNotification(firebaseApp, tokens, title, body)
    successCount = result.successCount
    failureCount = result.failureCount
    // Mark sent if at least one device received it
    finalStatus = successCount > 0 || tokens.length === 0 ? 'sent' : 'failed'
  } catch (err) {
    console.error('[Send] FCM multicast error:', err)
    failureCount = tokens.length
  }

  // ── 7. Update record with final status ────────────────────────────────────
  await adminClient
    .from('notifications')
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      recipient_count: successCount,
    })
    .eq('id', notifRecord.id)

  return {
    success: true,
    notificationId: notifRecord.id,
    recipientCount: successCount,
    failureCount,
    status: finalStatus,
  }
}
