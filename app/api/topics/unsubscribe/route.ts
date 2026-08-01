import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { unsubscribeTokensFromTopic } from '@/lib/firebase/admin'
import { downloadFromR2 } from '@/lib/r2/client'
import type { FirebaseCredentials } from '@/lib/firebase/admin'

/**
 * POST /api/topics/unsubscribe
 *
 * Unsubscribe a device from a topic.
 * Auth: appId + apiKey
 */

const schema = z.object({
  appId:    z.string().min(1),
  apiKey:   z.string().min(1),
  fcmToken: z.string().min(1),
  topic:    z.string().min(1),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
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

  const fileContent = await downloadFromR2(project.firebaseJsonPath)
  if (!fileContent) {
    return NextResponse.json({ success: false, error: 'Failed to load Firebase credentials' }, { status: 500 })
  }

  let credentials: FirebaseCredentials
  try { credentials = JSON.parse(fileContent) as FirebaseCredentials }
  catch { return NextResponse.json({ success: false, error: 'Invalid Firebase credentials' }, { status: 500 }) }

  const result = await unsubscribeTokensFromTopic(credentials, [fcmToken], topic)

  return NextResponse.json({
    success:      result.successCount > 0,
    successCount: result.successCount,
    failureCount: result.failureCount,
  })
}
