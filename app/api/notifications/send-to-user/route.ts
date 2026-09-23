import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'
import { getProjectCredentials } from '@/lib/firebase/credentials-loader'
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
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { projectId, externalUserId, title, body: notifBody } = parsed.data
  const db = await getDb()

  // Verify project ownership
  const [project] = await db
    .select({
      id: projects.id,
      firebaseJsonPath: projects.firebaseJsonPath,
      firebaseCredentials: projects.firebaseCredentials,
      appId: projects.appId,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  // Find all devices with this externalUserId (or legacy userId)
  const userDevices = await db
    .select({ fcmToken: devices.fcmToken, deviceModel: devices.deviceModel })
    .from(devices)
    .where(and(
      eq(devices.projectId, project.id),
      or(
        eq(devices.externalUserId, externalUserId),
        eq(devices.userId, externalUserId),
      ),
    ))

  if (userDevices.length === 0) {
    return NextResponse.json({
      success: false,
      error:   `No devices found for user "${externalUserId}"`,
    }, { status: 404 })
  }

  const tokens = userDevices.map((d) => d.fcmToken).filter(Boolean)

  // Load Firebase credentials
  const credentials = (await getProjectCredentials(project)) as unknown as FirebaseCredentials | null
  if (!credentials) {
    return NextResponse.json({ success: false, error: 'No Firebase credentials configured' }, { status: 422 })
  }

  const v = validateFirebaseCredentials(credentials as unknown as Record<string, unknown>)
  if (!v.valid) return NextResponse.json({ success: false, error: v.error }, { status: 422 })

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
