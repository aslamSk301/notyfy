'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics, devices, deviceTopics } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'
import { generateSecureToken } from '@/lib/utils'

const createSchema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1, 'Topic name is required').max(50)
                .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  description: z.string().max(200).optional(),
})

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllTopics() {
  try {
    const session = await requireSession()
    const db = await getDb()

    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) return { topics: [] }

    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))
    const projectIds = userProjects.map((p) => p.id)

    // Get topics with device counts
    const rows = await db
      .select()
      .from(topics)
      .orderBy(topics.name)

    const filtered = rows.filter((t) => projectIds.includes(t.projectId))

    // Get device counts per topic
    const topicIds = filtered.map((t) => t.id)
    let deviceCounts: Record<string, number> = {}

    if (topicIds.length > 0) {
      const counts = await db
        .select({
          topicId: deviceTopics.topicId,
          count:   sql<number>`count(*)`,
        })
        .from(deviceTopics)
        .where(inArray(deviceTopics.topicId, topicIds))
        .groupBy(deviceTopics.topicId)

      deviceCounts = Object.fromEntries(counts.map((c) => [c.topicId, Number(c.count)]))
    }

    const enriched = filtered.map((t) => ({
      ...t,
      projectName:  projectMap[t.projectId] ?? '—',
      deviceCount:  deviceCounts[t.id] ?? 0,
    }))

    return { topics: enriched }
  } catch (e) {
    return { topics: [], error: (e as Error).message }
  }
}

export async function getProjectTopics(projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { topics: [] }

    const rows = await db
      .select()
      .from(topics)
      .where(eq(topics.projectId, projectId))
      .orderBy(topics.name)

    return { topics: rows }
  } catch (e) {
    return { topics: [], error: (e as Error).message }
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTopic(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSession()
    const parsed  = createSchema.safeParse({
      projectId:   formData.get('projectId'),
      name:        formData.get('name'),
      description: formData.get('description') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Project not found' }

    const [existing] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.projectId, project.id), eq(topics.name, parsed.data.name)))
      .limit(1)

    if (existing) return { error: `Topic "${parsed.data.name}" already exists` }

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

    revalidatePath('/dashboard/topics')
    return { success: true, topic: created }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Assign all project devices to a topic ─────────────────────────────────────

export async function assignAllDevicesToTopic(topicId: string) {
  try {
    const session = await requireSession()
    const db      = await getDb()

    // Verify topic ownership
    const [topic] = await db
      .select({ id: topics.id, projectId: topics.projectId, name: topics.name })
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1)

    if (!topic) return { error: 'Topic not found' }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, topic.projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Not authorized' }

    // Get all project devices
    const allDevices = await db
      .select({ id: devices.id })
      .from(devices)
      .where(eq(devices.projectId, project.id))

    if (allDevices.length === 0) return { error: 'No devices registered for this project' }

    // Get already assigned device IDs
    const alreadyAssigned = await db
      .select({ deviceId: deviceTopics.deviceId })
      .from(deviceTopics)
      .where(eq(deviceTopics.topicId, topicId))

    const assignedSet = new Set(alreadyAssigned.map((d) => d.deviceId))
    const newDevices  = allDevices.filter((d) => !assignedSet.has(d.id))

    // Insert new assignments
    let assigned = 0
    for (const device of newDevices) {
      await db.insert(deviceTopics).values({
        id:         generateSecureToken(8),
        deviceId:   device.id,
        topicId:    topicId,
        assignedBy: 'admin',
      })
      assigned++
    }

    revalidatePath('/dashboard/topics')
    return {
      success: true,
      assigned,
      total:   allDevices.length,
      message: assigned > 0
        ? `${assigned} device(s) assigned to "${topic.name}"`
        : `All ${allDevices.length} devices already in "${topic.name}"`,
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTopic(topicId: string) {
  try {
    const session = await requireSession()
    const db      = await getDb()

    const [topic] = await db
      .select({ projectId: topics.projectId })
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1)

    if (!topic) return { error: 'Topic not found' }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, topic.projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Not authorized' }

    await db.delete(topics).where(eq(topics.id, topicId))
    revalidatePath('/dashboard/topics')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
