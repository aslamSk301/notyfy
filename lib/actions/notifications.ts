'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationCore } from '@/lib/send-notification-core'
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

  // Step 1: get project IDs belonging to this user
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)

  if (!projects || projects.length === 0) return { notifications: [] }

  const projectIds = projects.map((p) => p.id)

  // Step 2: fetch notifications by project IDs (no cross-table filter needed)
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })
    .limit(200)

  // Step 3: attach project name client-side (avoids problematic join)
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))
  const enriched = (data ?? []).map((n) => ({
    ...n,
    projects: { name: projectMap[n.project_id] ?? '—' },
  }))

  return { notifications: enriched, error: error?.message }
}

/** Send a push notification — directly calls core logic, no internal HTTP fetch */
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

  // Validate project ownership before calling core logic
  const { data: project } = await supabase
    .from('projects')
    .select('id, firebase_json_path')
    .eq('id', parsed.data.projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { error: 'Project not found' }
  if (!project.firebase_json_path) {
    return { error: 'No Firebase credentials uploaded for this project. Go to Projects and upload your Firebase Service Account JSON.' }
  }

  // Directly call core logic — no self-referential HTTP fetch
  const result = await sendNotificationCore(
    user.id,
    parsed.data.projectId,
    parsed.data.title,
    parsed.data.body,
  )

  if (!result.success) {
    return { error: result.error ?? 'Failed to send notification' }
  }

  revalidatePath('/dashboard/notifications')
  return { success: true, recipientCount: result.recipientCount ?? 0 }
}
