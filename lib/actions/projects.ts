'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateAppId, generateSecureToken } from '@/lib/utils'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(80, 'Name is too long'),
})

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(80, 'Name is too long'),
})

/** Fetch all projects for the authenticated user */
export async function getProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { projects: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return { projects: data ?? [], error: error?.message }
}

/** Fetch a single project by ID (validates ownership) */
export async function getProject(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { project: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  return { project: data, error: error?.message }
}

/** Create a new project with auto-generated App ID and API key */
export async function createProject(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = { name: formData.get('name') as string }
  const parsed = createProjectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const firebaseFile = formData.get('firebaseJson') as File | null
  let firebaseJsonPath: string | null = null

  // Upload Firebase JSON if provided
  if (firebaseFile && firebaseFile.size > 0) {
    const uploadResult = await uploadFirebaseJson(user.id, firebaseFile)
    if (uploadResult.error) return { error: uploadResult.error }
    firebaseJsonPath = uploadResult.path ?? null
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      app_id: generateAppId(),
      api_key: generateSecureToken(32),
      firebase_json_path: firebaseJsonPath,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/projects')
  return { success: true, project: data }
}

/** Update project name */
export async function updateProject(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
  }
  const parsed = updateProjectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { error } = await supabase
    .from('projects')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/projects')
  return { success: true }
}

/** Upload / replace Firebase Service Account JSON for a project */
export async function updateFirebaseJson(projectId: string, file: File) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validate project ownership first
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, firebase_json_path')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) return { error: 'Project not found' }

  // Delete old file if present
  if (project.firebase_json_path) {
    const adminClient = createAdminClient()
    await adminClient.storage
      .from('firebase-credentials')
      .remove([project.firebase_json_path])
  }

  const uploadResult = await uploadFirebaseJson(user.id, file, projectId)
  if (uploadResult.error) return { error: uploadResult.error }

  const { error } = await supabase
    .from('projects')
    .update({ firebase_json_path: uploadResult.path })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/projects')
  return { success: true }
}

/** Delete a project and all its data (cascade) */
export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch firebase path before deleting so we can clean up storage
  const { data: project } = await supabase
    .from('projects')
    .select('firebase_json_path')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  // Clean up Firebase JSON from storage
  if (project?.firebase_json_path) {
    const adminClient = createAdminClient()
    await adminClient.storage
      .from('firebase-credentials')
      .remove([project.firebase_json_path])
  }

  revalidatePath('/dashboard/projects')
  return { success: true }
}

// ============================================================
// Internal helper — uploads Firebase JSON to private bucket
// ============================================================
async function uploadFirebaseJson(
  userId: string,
  file: File,
  projectId?: string
): Promise<{ path?: string; error?: string }> {
  // Validate it's a JSON file
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    return { error: 'Firebase credentials must be a JSON file' }
  }
  if (file.size > 100 * 1024) {
    return { error: 'Firebase JSON file must be under 100 KB' }
  }

  // Validate JSON content
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    if (!json.type || json.type !== 'service_account') {
      return { error: 'Invalid Firebase service account JSON — missing "type: service_account"' }
    }
  } catch {
    return { error: 'Invalid JSON file' }
  }

  const adminClient = createAdminClient()
  const storagePath = `${userId}/${projectId ?? 'new'}/firebase-credentials.json`

  const { error: uploadError } = await adminClient.storage
    .from('firebase-credentials')
    .upload(storagePath, file, {
      contentType: 'application/json',
      upsert: true,
    })

  if (uploadError) return { error: `Storage upload failed: ${uploadError.message}` }

  return { path: storagePath }
}
