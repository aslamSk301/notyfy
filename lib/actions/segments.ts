'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, inArray, desc, count, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, segments, segmentRules, devices } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'
import { createSegment, getSegments, deleteSegment } from '@/lib/services/segment-service'
import type { SegmentRuleInput } from '@/types/onesignal'

const ruleSchema = z.object({
  field:    z.enum(['country', 'language', 'platform', 'osVersion', 'appVersion', 'notificationPermission', 'status', 'lastOpen', 'userId']),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value:    z.string(),
})

const createSchema = z.object({
  projectId:   z.string().min(1, 'Project is required'),
  name:        z.string().min(1, 'Segment name is required').max(100),
  description: z.string().max(300).optional(),
  rules:       z.array(ruleSchema).min(1, 'At least one filter rule is required'),
})

/** Fetch all segments across user projects with dynamic member counts */
export async function getAllSegments() {
  try {
    const session = await requireSession()
    const db = await getDb()

    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) return { segments: [], projects: [] }

    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))
    const projectIds = userProjects.map((p) => p.id)

    // Fetch segments
    const allSegs = await db
      .select()
      .from(segments)
      .where(inArray(segments.projectId, projectIds))
      .orderBy(desc(segments.createdAt))

    const enriched = await Promise.all(
      allSegs.map(async (s) => {
        const rules = await db
          .select()
          .from(segmentRules)
          .where(eq(segmentRules.segmentId, s.id))

        // Get total device count for project
        const [devCount] = await db
          .select({ total: count() })
          .from(devices)
          .where(and(eq(devices.projectId, s.projectId), eq(devices.status, 'active')))

        return {
          ...s,
          projectName: projectMap[s.projectId] ?? '—',
          rules,
          pushSubscribers: devCount?.total ?? 0,
          status: 'Active',
        }
      })
    )

    return { segments: enriched, projects: userProjects }
  } catch (e) {
    return { segments: [], projects: [], error: (e as Error).message }
  }
}

/** Create a new dynamic segment */
export async function createSegmentAction(payload: {
  projectId: string
  name: string
  description?: string
  rules: SegmentRuleInput[]
}) {
  try {
    const session = await requireSession()
    const parsed = createSchema.safeParse(payload)

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message }
    }

    const db = await getDb()
    // Verify project ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Project not found' }

    const newSegment = await createSegment({
      projectId:   parsed.data.projectId,
      name:        parsed.data.name,
      description: parsed.data.description,
      rules:       parsed.data.rules,
    })

    revalidatePath('/dashboard/segments')
    return { success: true, segment: newSegment }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Delete segment */
export async function deleteSegmentAction(segmentId: string, projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Not authorized' }

    await deleteSegment(segmentId, projectId)
    revalidatePath('/dashboard/segments')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Fetch Audience / Subscriptions / Users data matching OneSignal Records UI */
export async function getAudienceRecords() {
  try {
    const session = await requireSession()
    const db = await getDb()

    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) return { records: [], total: 0 }

    const projectIds = userProjects.map((p) => p.id)
    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))

    const rows = await db
      .select()
      .from(devices)
      .where(inArray(devices.projectId, projectIds))
      .orderBy(desc(devices.lastActive))
      .limit(100)

    const enriched = rows.map((r) => ({
      ...r,
      projectName: projectMap[r.projectId] ?? '—',
    }))

    return { records: enriched, total: enriched.length }
  } catch (e) {
    return { records: [], total: 0, error: (e as Error).message }
  }
}
