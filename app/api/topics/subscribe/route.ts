import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, devices, topics } from '@/lib/db/schema'
import { subscribeTokensToTopic } from '@/lib/firebase/admin'
import { downloadFromR2 } from '@/lib/r2/client'
import { generateSecureToken } from '@/lib/utils'
import type { FirebaseCredentials } from '@/lib/firebase/admin'

/**
 * POST /api/topics/subscribe
 *
 * Subscribe a device to a topic.
 * Auth: appId + apiKey
 */

const schema = z.object({
  appId:    z.string().min(1),
  apiKey:   z.string().min(1),
  fcmToken: z.string().min(1),
  topic:    z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Topic name must be alphanumeric'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { appId, apiKey, fcmToken, topic } = parsed.data
  const db = await getDb()

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.appId, appId), eq(projects.apiKey, apiKey)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Invalid appId or apiKey' }, { status: 401 })
  }

  if (!project.firebaseJsonPath) {
    return NextResponse.json({ success: false, error: 'No Firebase credentials configured' }, { status: 422 })
  }

  // Load Firebase credentials
  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    return NextResponse.json({ success: false, error: 'Failed to load Firebase credentials' }, { status: 500 })
  }

  let credentials: FirebaseCredentials
  try { credentials = JSON.parse(fileContent) as FirebaseCredentials }
  catch { return NextResponse.json({ success: false, error: 'Invalid Firebase credentials' }, { status: 500 }) }

  // Subscribe via FCM IID API
  const result = await subscribeTokensToTopic(credentials, [fcmToken], topic)

  // Save topic to DB if not exists (for dashboard display)
  const existingTopic = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, project.id), eq(topics.name, topic)))
    .limit(1)

  if (existingTopic.length === 0) {
    await db.insert(topics).values({
      id:        generateSecureToken(8),
      projectId: project.id,
      name:      topic,
    })
  }

  return NextResponse.json({
    success:      result.successCount > 0,
    successCount: result.successCount,
    failureCount: result.failureCount,
  })
}
