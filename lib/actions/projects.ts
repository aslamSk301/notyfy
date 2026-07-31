'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'
import { uploadToR2, deleteFromR2, buildFirebaseCredentialsKey } from '@/lib/r2/client'
import { generateAppId, generateSecureToken } from '@/lib/utils'

const createSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(80),
})

const updateSchema = z.object({
  id:   z.string().min(1),
  name: z.string().min(1, 'Project name is required').max(80),
})

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getProjects() {
  try {
    const session = await requireSession()
    const db = await getDb()
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, session.userId))
      .orderBy(projects.createdAt)
    return { projects: rows, error: undefined }
  } catch (e) {
    return { projects: [], error: (e as Error).message }
  }
}

export async function getProject(id: string) {
  try {
    const session = await requireSession()
    const db = await getDb()
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.userId)))
      .limit(1)
    return { project: row ?? null, error: undefined }
  } catch (e) {
    return { project: null, error: (e as Error).message }
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createProject(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSession()
    const parsed = createSchema.safeParse({ name: formData.get('name') })
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const db = await getDb()
    const projectId = generateSecureToken(16)

    // Handle optional Firebase JSON upload
    const firebaseFile = formData.get('firebaseJson') as File | null
    let firebaseJsonPath: string | null = null

    if (firebaseFile && firebaseFile.size > 0) {
      const uploadResult = await validateAndUploadFirebaseJson(
        session.userId, projectId, firebaseFile
      )
      if (uploadResult.error) return { error: uploadResult.error }
      firebaseJsonPath = uploadResult.key ?? null
    }

    const [created] = await db
      .insert(projects)
      .values({
        id:               projectId,
        userId:           session.userId,
        name:             parsed.data.name,
        appId:            generateAppId(),
        apiKey:           generateSecureToken(32),
        firebaseJsonPath,
      })
      .returning()

    revalidatePath('/dashboard/projects')
    return { success: true, project: created }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProject(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSession()
    const parsed = updateSchema.safeParse({
      id:   formData.get('id'),
      name: formData.get('name'),
    })
    if (!parsed.success) return { error: parsed.error.errors[0].message }

    const db = await getDb()
    await db
      .update(projects)
      .set({ name: parsed.data.name })
      .where(and(eq(projects.id, parsed.data.id), eq(projects.userId, session.userId)))

    revalidatePath('/dashboard/projects')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Firebase JSON upload ──────────────────────────────────────────────────────

export async function updateFirebaseJson(projectId: string, file: File) {
  try {
    const session = await requireSession()
    const db = await getDb()

    // Verify ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Project not found' }

    // Delete old file if exists
    if (project.firebaseJsonPath) {
      await deleteFromR2(project.firebaseJsonPath)
    }

    const result = await validateAndUploadFirebaseJson(session.userId, projectId, file)
    if (result.error) return { error: result.error }

    await db
      .update(projects)
      .set({ firebaseJsonPath: result.key })
      .where(eq(projects.id, projectId))

    revalidatePath('/dashboard/projects')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteProject(projectId: string) {
  try {
    const session = await requireSession()
    const db = await getDb()

    const [project] = await db
      .select({ firebaseJsonPath: projects.firebaseJsonPath })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .limit(1)

    if (!project) return { error: 'Project not found' }

    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))

    // Cleanup R2 file
    if (project.firebaseJsonPath) {
      await deleteFromR2(project.firebaseJsonPath)
    }

    revalidatePath('/dashboard/projects')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function validateAndUploadFirebaseJson(
  userId: string,
  projectId: string,
  file: File
): Promise<{ key?: string; error?: string }> {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    return { error: 'Firebase credentials must be a .json file' }
  }
  if (file.size > 100 * 1024) {
    return { error: 'Firebase JSON must be under 100 KB' }
  }

  const text = await file.text()

  try {
    const json = JSON.parse(text)
    if (json.type !== 'service_account') {
      return { error: 'Invalid Firebase service account JSON — missing "type: service_account"' }
    }
  } catch {
    return { error: 'Invalid JSON file' }
  }

  const key = buildFirebaseCredentialsKey(userId, projectId)
  await uploadToR2(key, text)
  return { key }
}
