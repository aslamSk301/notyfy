import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { generateSecureToken } from '@/lib/utils'

/**
 * POST /api/topics/create
 *
 * Dashboard-only endpoint — requires user session.
 * Creates a new topic for a project.
 */

const schema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1).max(50)
                 .regex(/^[a-zA-Z0-9_-]+$/, 'Topic name: letters, numbers, _ and - only'),
  description: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  // Auth — dashboard session required
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

  // Verify project ownership
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, session.userId)))
    .limit(1)

  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  // Check for duplicate
  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.projectId, project.id), eq(topics.name, parsed.data.name)))
    .limit(1)

  if (existing) {
    return NextResponse.json({ success: false, error: 'Topic already exists' }, { status: 409 })
  }

  const [created] = await db
    .insert(topics)
    .values({
      id:          generateSecureToken(8),
      projectId:   project.id,
      name:        parsed.data.name,
      description: parsed.data.description ?? null,
      isActive:    true,
    })
    .returning()

  return NextResponse.json({ success: true, topic: created })
}
