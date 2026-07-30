import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getFirebaseApp, sendMulticastNotification } from '@/lib/firebase/admin'
import { z } from 'zod'

/**
 * POST /api/notifications/send
 *
 * Internal endpoint — called by the sendNotification server action.
 * Authenticates via userId passed from the server action (never from the browser).
 *
 * Flow:
 * 1. Validate input
 * 2. Verify project ownership via userId
 * 3. Download Firebase JSON from private Supabase Storage
 * 4. Initialize Firebase Admin app (per-project, cached)
 * 5. Fetch all FCM tokens for the project
 * 6. Send multicast notification
 * 7. Save notification history
 * 8. Return result
 */

const sendSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  _userId: z.string().min(1), // passed from server action, never from browser
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { projectId, title, body: notifBody, _userId } = parsed.data
  const adminClient = createAdminClient()

  // ── 1. Verify project ownership ──────────────────────────────────────────
  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('id, firebase_json_path')
    .eq('id', projectId)
    .eq('user_id', _userId)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  if (!project.firebase_json_path) {
    return NextResponse.json(
      { success: false, error: 'No Firebase credentials configured for this project' },
      { status: 422 }
    )
  }

  // ── 2. Download Firebase JSON from private storage ────────────────────────
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from('firebase-credentials')
    .download(project.firebase_json_path)

  if (downloadError || !fileData) {
    console.error('[Send] Storage download error:', downloadError)
    return NextResponse.json(
      { success: false, error: 'Failed to load Firebase credentials' },
      { status: 500 }
    )
  }

  let credentials: Record<string, unknown>
  try {
    const text = await fileData.text()
    credentials = JSON.parse(text)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid Firebase credentials JSON' },
      { status: 500 }
    )
  }

  // ── 3. Initialize per-project Firebase app ────────────────────────────────
  let firebaseApp
  try {
    firebaseApp = getFirebaseApp(projectId, credentials as Parameters<typeof getFirebaseApp>[1])
  } catch (err) {
    console.error('[Send] Firebase init error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize Firebase' },
      { status: 500 }
    )
  }

  // ── 4. Fetch all device tokens for this project ───────────────────────────
  const { data: devices, error: devicesError } = await adminClient
    .from('devices')
    .select('fcm_token')
    .eq('project_id', projectId)

  if (devicesError) {
    return NextResponse.json({ success: false, error: 'Failed to fetch devices' }, { status: 500 })
  }

  const tokens = (devices ?? []).map((d: { fcm_token: string }) => d.fcm_token).filter(Boolean)

  // ── 5. Create notification record (pending) ───────────────────────────────
  const { data: notifRecord, error: insertError } = await adminClient
    .from('notifications')
    .insert({
      project_id: projectId,
      title,
      body: notifBody,
      status: 'pending',
      recipient_count: tokens.length,
    })
    .select()
    .single()

  if (insertError || !notifRecord) {
    return NextResponse.json(
      { success: false, error: 'Failed to create notification record' },
      { status: 500 }
    )
  }

  // ── 6. Send multicast push notification ──────────────────────────────────
  let successCount = 0
  let failureCount = 0
  let finalStatus: 'sent' | 'failed' = 'failed'

  try {
    const result = await sendMulticastNotification(firebaseApp, tokens, title, notifBody)
    successCount = result.successCount
    failureCount = result.failureCount
    finalStatus = successCount > 0 ? 'sent' : 'failed'
  } catch (err) {
    console.error('[Send] FCM error:', err)
    failureCount = tokens.length
  }

  // ── 7. Update notification record with final status ───────────────────────
  await adminClient
    .from('notifications')
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      recipient_count: successCount,
    })
    .eq('id', notifRecord.id)

  return NextResponse.json({
    success: true,
    data: {
      notificationId: notifRecord.id,
      recipientCount: successCount,
      failureCount,
      status: finalStatus,
    },
  })
}
