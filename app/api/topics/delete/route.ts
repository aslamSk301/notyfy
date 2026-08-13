import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'

/**
 * DELETE /api/topics/delete
 *
 * Dashboard-only — requires user session.
 * Deletes a topic from a project.
 */

const schema = z.object({
  topicId: z.string().min(1),
})

export async function DELETE(request: NextRequest) {
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

  const db = await getDb()

  // Verify ownership via join
  const [topic] = await db
    .select({ id: topics.id, projectId: topics.projectId })
    .from(topics)
    .where(eq(topics.id, parsed.data.topicId))
    .limit(1)

  if (!topic) {
    return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 })
  }

  // Verify the topic belongs to one of the user's projects
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, topic.projectId), eq(projects.userId, session.userId)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 })
  }

  await db.delete(topics).where(eq(topics.id, parsed.data.topicId))

  return NextResponse.json({ success: true })
}
