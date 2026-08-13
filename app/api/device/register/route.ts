import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'
import { subscribeTokensToTopic } from '@/lib/firebase/admin'
import { downloadFromR2 } from '@/lib/r2/client'
import type { FirebaseCredentials } from '@/lib/firebase/admin'

/**
 * POST /api/device/register
 *
 * Public endpoint — authenticated by appId + apiKey.
 * Accepts enhanced device metadata (OneSignal-compatible).
 * Auto-subscribes device to:
 *   - all_{appId}                  → all devices in this project
 *   - {platform}_{appId}           → platform-specific topic
 */

const schema = z.object({
  appId:          z.string().min(1, 'appId is required'),
  apiKey:         z.string().min(1, 'apiKey is required'),
  fcmToken:       z.string().optional().default(''),
  platform:       z.enum(['android', 'ios', 'flutter', 'react-native']),
  deviceId:       z.string().min(1, 'deviceId is required'),
  // Enhanced fields (all optional — for OneSignal parity)
  appVersion:     z.string().optional(),
  deviceModel:    z.string().optional(),   // "Samsung Galaxy S24"
  deviceOs:       z.string().optional(),   // "Android 14"
  language:       z.string().optional(),   // "en"
  timezone:       z.string().optional(),   // "Asia/Karachi"
  externalUserId: z.string().optional(),   // developer's own user ID
  sdkVersion:     z.string().optional(),   // "1.0.0"
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const {
    appId, apiKey, fcmToken, platform, deviceId,
    appVersion, deviceModel, deviceOs, language,
    timezone, externalUserId, sdkVersion,
  } = parsed.data

  const db = await getDb()

  // ── Validate appId + apiKey ───────────────────────────────────────────────
  const [project] = await db
    .select({ id: projects.id, appId: projects.appId, firebaseJsonPath: projects.firebaseJsonPath })
    .from(projects)
    .where(and(eq(projects.appId, appId), eq(projects.apiKey, apiKey)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Invalid appId or apiKey' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // ── Upsert device ─────────────────────────────────────────────────────────
  const [existing] = await db
    .select({ id: devices.id, fcmToken: devices.fcmToken })
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, deviceId)))
    .limit(1)

  const oldToken = existing?.fcmToken
  const activeToken = fcmToken || oldToken || ''

  if (existing) {
    await db
      .update(devices)
      .set({
        ...(fcmToken ? { fcmToken } : {}),
        appVersion:         appVersion     ?? undefined,
        deviceModel:        deviceModel    ?? undefined,
        deviceOs:           deviceOs       ?? undefined,
        language:           language       ?? undefined,
        timezone:           timezone       ?? undefined,
        externalUserId:     externalUserId ?? undefined,
        sdkVersion:         sdkVersion     ?? undefined,
        subscriptionStatus: 'subscribed',
        lastActive:         now,
      })
      .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, deviceId)))
  } else {
    await db.insert(devices).values({
      id:                 generateSecureToken(16),
      projectId:          project.id,
      deviceId,
      fcmToken:           activeToken,
      platform,
      appVersion:         appVersion     ?? null,
      deviceModel:        deviceModel    ?? null,
      deviceOs:           deviceOs       ?? null,
      language:           language       ?? null,
      timezone:           timezone       ?? null,
      externalUserId:     externalUserId ?? null,
      sdkVersion:         sdkVersion     ?? null,
      subscriptionStatus: 'subscribed',
      lastActive:         now,
    })
  }

  // ── Auto-subscribe to topics (fire and forget) ────────────────────────────
  // Only if firebase credentials & non-empty token exist
  if (project.firebaseJsonPath && activeToken) {
    autoSubscribeTopics({
      projectId:    project.id,
      appId:        project.appId,
      fcmToken:     activeToken,
      oldToken:     oldToken !== activeToken ? oldToken : undefined,
      platform,
      firebasePath: project.firebaseJsonPath,
    }).catch((err) => {
      console.error('[Topics] Auto-subscribe failed:', err)
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Device registered successfully',
    data: { deviceId, platform },
  })
}

// ── Internal — auto-subscribe device to standard topics ──────────────────────
async function autoSubscribeTopics(opts: {
  projectId:    string
  appId:        string
  fcmToken:     string
  oldToken?:    string
  platform:     string
  firebasePath: string
}) {
  const { appId, fcmToken, platform, firebasePath } = opts

  const fileContent = await downloadFromR2(firebasePath)
  if (!fileContent) return

  let credentials: FirebaseCredentials
  try { credentials = JSON.parse(fileContent) as FirebaseCredentials }
  catch { return }

  // Standard auto-topics
  const topicsToSubscribe = [
    `all_${appId}`,             // all devices in this project
    `${platform}_${appId}`,     // e.g. android_app_abc123
  ]

  await Promise.allSettled(
    topicsToSubscribe.map((topic) =>
      subscribeTokensToTopic(credentials, [fcmToken], topic)
    )
  )
}
