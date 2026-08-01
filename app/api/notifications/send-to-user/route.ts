import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import {
  sendMulticastNotification,
  validateFirebaseCredentials,
  type FirebaseCredentials,
} from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

/**
 * POST /api/notifications/send-to-user
 *
 * Send notification to a specific user by their External User ID.
 * Sends to ALL devices registered with that externalUserId.
 *
 * Auth: dashboard session OR appId + apiKey (for programmatic use)
 */

const schema = z.object({
  projectId:      z.string().min(1),
  externalUserId: z.string().min(1, 'externalUserId is required'),
  title:          z.string().min(1).max(100),
  body:           z.string().min(1).max(500),
})

export async function POST(request: NextRequest) {
  // Auth via session (dashboard) or could be extended for API key auth
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { projectId, externalUserId, title, body: notifBody } = parsed.data
  const db = await getDb()

  // Verify project ownership
  const [project] = await db
    .select({ id: projects.id, firebaseJsonPath: projects.firebaseJsonPath, appId: projects.appId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  if (!project.firebaseJsonPath) {
    return NextResponse.json({ success: false, error: 'No Firebase credentials configured' }, { status: 422 })
  }

  // Find all devices with this externalUserId
  const userDevices = await db
    .select({ fcmToken: devices.fcmToken, deviceModel: devices.deviceModel })
    .from(devices)
    .where(and(
      eq(devices.projectId, project.id),
      eq(devices.externalUserId, externalUserId),
    ))

  if (userDevices.length === 0) {
    return NextResponse.json({
      success: false,
      error:   `No devices found for user "${externalUserId}"`,
    }, { status: 404 })
  }

  const tokens = userDevices.map((d) => d.fcmToken).filter(Boolean)

  // Load Firebase credentials
  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    return NextResponse.json({ success: false, error: 'Failed to load Firebase credentials' }, { status: 500 })
  }

  let credentials: FirebaseCredentials
  try {
    const json = JSON.parse(fileContent) as Record<string, unknown>
    const v    = validateFirebaseCredentials(json)
    if (!v.valid) return NextResponse.json({ success: false, error: v.error }, { status: 422 })
    credentials = json as FirebaseCredentials
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid Firebase credentials' }, { status: 500 })
  }

  // Send to all user devices
  const result = await sendMulticastNotification(credentials, tokens, title, notifBody)

  return NextResponse.json({
    success:        result.successCount > 0,
    recipientCount: result.successCount,
    failureCount:   result.failureCount,
    deviceCount:    tokens.length,
    externalUserId,
  })
}
