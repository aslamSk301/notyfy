'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const sendSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(100),
  body: z.string().min(1, 'Body is required').max(500),
})

/** Fetch notification history for a project */
export async function getNotifications(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notifications: [], error: 'Not authenticated' }

  // Validate project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { notifications: [], error: 'Project not found' }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)

  return { notifications: data ?? [], error: error?.message }
}

/** Fetch all notifications across all user projects */
export async function getAllNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notifications: [], error: 'Not authenticated' }

  // Get user's project IDs first
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)

  if (!projects || projects.length === 0) return { notifications: [] }

  const projectIds = projects.map((p) => p.id)

  const { data, error } = await supabase
    .from('notifications')
    .select('*, projects(name)')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })
    .limit(200)

  return { notifications: data ?? [], error: error?.message }
}

/** Send a push notification via the API route (calls /api/notifications/send internally) */
export async function sendNotification(_prevState: unknown, formData: FormData) {
  const raw = {
    projectId: formData.get('projectId') as string,
    title: formData.get('title') as string,
    body: formData.get('body') as string,
  }

  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validate project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, firebase_json_path')
    .eq('id', parsed.data.projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { error: 'Project not found' }
  if (!project.firebase_json_path) {
    return { error: 'No Firebase credentials uploaded for this project' }
  }

  // Call the internal API route
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      body: parsed.data.body,
      // Pass user session via service token — the API validates project ownership
      _userId: user.id,
    }),
  })

  const result = await response.json()

  if (!response.ok || !result.success) {
    return { error: result.error ?? 'Failed to send notification' }
  }

  revalidatePath('/dashboard/notifications')
  return { success: true, recipientCount: result.data?.recipientCount ?? 0 }
}
