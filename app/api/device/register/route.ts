import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'

/**
 * POST /api/device/register
 *
 * Public endpoint — authenticated by appId + apiKey.
 * Used by mobile SDKs (Flutter, React Native, Android) to register FCM tokens.
 */

const schema = z.object({
  appId:      z.string().min(1, 'appId is required'),
  apiKey:     z.string().min(1, 'apiKey is required'),
  fcmToken:   z.string().min(1, 'fcmToken is required'),
  platform:   z.enum(['android', 'ios', 'flutter', 'react-native'], {
    errorMap: () => ({ message: 'platform must be android, ios, flutter, or react-native' }),
  }),
  deviceId:   z.string().min(1, 'deviceId is required'),
  appVersion: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { appId, apiKey, fcmToken, platform, deviceId, appVersion } = parsed.data

  const db = await getDb()

  // Validate appId + apiKey — find matching project
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.appId, appId), eq(projects.apiKey, apiKey)))
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { success: false, error: 'Invalid appId or apiKey' },
      { status: 401 }
    )
  }

  // Check if device already registered for this project
  const [existing] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, deviceId)))
    .limit(1)

  if (existing) {
    // Update FCM token (token refresh or reinstall)
    await db
      .update(devices)
      .set({ fcmToken, appVersion: appVersion ?? null })
      .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, deviceId)))
  } else {
    // New device — insert
    await db.insert(devices).values({
      id:         generateSecureToken(16),
      projectId:  project.id,
      deviceId,
      fcmToken,
      platform,
      appVersion: appVersion ?? null,
    })
  }

  return NextResponse.json({ success: true, message: 'Device registered successfully' })
}
