import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics } from '@/lib/db/schema'

/**
 * GET /api/topics?appId=xxx&apiKey=xxx
 *
 * Public endpoint — authenticated by appId + apiKey.
 * Used by mobile SDKs to fetch available topics for this project.
 * Returns only active topics.
 *
 * Response:
 * {
 *   success: true,
 *   topics: [
 *     { id, name, description }
 *   ]
 * }
 */

const schema = z.object({
  appId:  z.string().min(1, 'appId is required'),
  apiKey: z.string().min(1, 'apiKey is required'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = {
    appId:  searchParams.get('appId')  ?? '',
    apiKey: searchParams.get('apiKey') ?? '',
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const db = await getDb()

  // Validate credentials
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.appId, parsed.data.appId), eq(projects.apiKey, parsed.data.apiKey)))
    .limit(1)

  if (!project) {
    return NextResponse.json(
      { success: false, error: 'Invalid appId or apiKey' },
      { status: 401 }
    )
  }

  // Fetch active topics
  const rows = await db
    .select({
      id:          topics.id,
      name:        topics.name,
      description: topics.description,
    })
    .from(topics)
    .where(and(eq(topics.projectId, project.id), eq(topics.isActive, true)))
    .orderBy(topics.name)

  return NextResponse.json({ success: true, topics: rows })
}
