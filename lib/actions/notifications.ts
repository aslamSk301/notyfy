'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray, desc } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects, notifications, topics } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'
import { sendNotificationCore } from '@/lib/send-notification-core'

const sendSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title:     z.string().min(1, 'Title is required').max(100),
  body:      z.string().min(1, 'Body is required').max(500),
  target:    z.string().min(1).default('all'),
})

/** Fetch all notifications across all user projects */
export async function getAllNotifications() {
  try {
    const session = await requireSession()
    const db = await getDb()

    // Step 1 — get user project IDs + names
    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) return { notifications: [] }

    const projectIds = userProjects.map((p) => p.id)
    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))

    // Step 2 — fetch notifications
    const rows = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.projectId, projectIds))
      .orderBy(desc(notifications.createdAt))
      .limit(200)

    const enriched = rows.map((n) => ({
      ...n,
      projects: { name: projectMap[n.projectId] ?? '—' },
    }))

    return { notifications: enriched }
  } catch (e) {
    return { notifications: [], error: (e as Error).message }
  }
}

/** Fetch notifications for a single project */
export async function getNotifications(projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    // Verify ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (!project) return { notifications: [], error: 'Project not found' }

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.projectId, projectId))
      .orderBy(desc(notifications.createdAt))
      .limit(100)

    return { notifications: rows }
  } catch (e) {
    return { notifications: [], error: (e as Error).message }
  }
}

/** Fetch all topics for a project */
export async function getProjectTopics(projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
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

/** Send a push notification */
export async function sendNotification(_prev: unknown, formData: FormData) {
  const raw = {
    projectId: formData.get('projectId') as string,
    title:     formData.get('title') as string,
    body:      formData.get('body') as string,
    target:    (formData.get('target') as string) || 'all',
  }

  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ id: projects.id, firebaseJsonPath: projects.firebaseJsonPath })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1)

    if (!project) return { error: 'Project not found' }
    if (!project.firebaseJsonPath) {
      return { error: 'No Firebase credentials uploaded for this project.' }
    }

    const result = await sendNotificationCore(
      session.userId,
      parsed.data.projectId,
      parsed.data.title,
      parsed.data.body,
      parsed.data.target,
    )

    if (!result.success) return { error: result.error ?? 'Failed to send notification' }

    revalidatePath('/dashboard/notifications')
    return { success: true, recipientCount: result.recipientCount ?? 0 }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
