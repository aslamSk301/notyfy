import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics, devices, deviceTopics } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { generateSecureToken } from '@/lib/utils'

/**
 * POST /api/topics/assign
 *
 * Admin assigns devices to a topic.
 * mode: 'all'      → assign ALL project devices to topic
 * mode: 'specific' → assign specific device IDs
 *
 * Auth: dashboard session required
 */

const schema = z.object({
  topicId: z.string().min(1),
  mode:    z.enum(['all', 'specific']).default('all'),
  deviceIds: z.array(z.string()).optional(), // only for mode: 'specific'
})

export async function POST(request: NextRequest) {
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

  const { topicId, mode, deviceIds } = parsed.data
  const db = await getDb()

  // Verify topic belongs to user's project
  const [topic] = await db
    .select({ id: topics.id, projectId: topics.projectId, name: topics.name })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1)

  if (!topic) return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 })

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, topic.projectId), eq(projects.userId, session.userId)))
    .limit(1)

  if (!project) return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 })

  // Get devices to assign
  let deviceRows: { id: string }[] = []

  if (mode === 'all') {
    deviceRows = await db
      .select({ id: devices.id })
      .from(devices)
      .where(eq(devices.projectId, project.id))
  } else if (mode === 'specific' && deviceIds && deviceIds.length > 0) {
    deviceRows = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(
        eq(devices.projectId, project.id),
        inArray(devices.id, deviceIds)
      ))
  }

  if (deviceRows.length === 0) {
    return NextResponse.json({ success: true, assigned: 0, message: 'No devices to assign' })
  }

  // Upsert device_topics — ignore duplicates
  let assigned = 0
  for (const device of deviceRows) {
    const [existing] = await db
      .select({ id: deviceTopics.id })
      .from(deviceTopics)
      .where(and(
        eq(deviceTopics.deviceId, device.id),
        eq(deviceTopics.topicId, topicId)
      ))
      .limit(1)

    if (!existing) {
      await db.insert(deviceTopics).values({
        id:         generateSecureToken(8),
        deviceId:   device.id,
        topicId:    topicId,
        assignedBy: 'admin',
      })
      assigned++
    }
  }

  return NextResponse.json({
    success: true,
    assigned,
    total:   deviceRows.length,
    message: `${assigned} new device(s) assigned to topic "${topic.name}"`,
  })
}
