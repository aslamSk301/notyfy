'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, topics } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'
import { generateSecureToken } from '@/lib/utils'

const createSchema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1, 'Topic name is required').max(50)
                .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  description: z.string().max(200).optional(),
})

/** Get all topics for a project */
export async function getTopicsForProject(projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { topics: [], error: 'Project not found' }

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

/** Get all topics across all user projects */
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

    const rows = await db
      .select()
      .from(topics)
      .orderBy(topics.name)

    const filtered = rows
      .filter((t) => projectIds.includes(t.projectId))
      .map((t) => ({ ...t, projectName: projectMap[t.projectId] ?? '—' }))

    return { topics: filtered }
  } catch (e) {
    return { topics: [], error: (e as Error).message }
  }
}

/** Create a new topic */
export async function createTopic(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSession()
    const parsed = createSchema.safeParse({
      projectId:   formData.get('projectId'),
      name:        formData.get('name'),
      description: formData.get('description') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.errors[0].message }

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

/** Delete a topic */
export async function deleteTopic(topicId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

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
