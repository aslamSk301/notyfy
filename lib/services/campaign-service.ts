/**
 * Notification Campaign Service (OneSignal Parity)
 * Handles campaign creation, target routing, status transitions, and analytics updates.
 */

import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { notificationCampaigns, projects } from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'
import type { CreateCampaignInput } from '@/types/onesignal'

/** Create a new campaign */
export async function createCampaign(input: CreateCampaignInput) {
  const db  = await getDb()
  const now = new Date().toISOString()

  const campaignId = generateSecureToken(16)

  const newCampaign = {
    id:           campaignId,
    projectId:    input.projectId,
    name:         input.name,
    title:        input.title,
    body:         input.body,
    image:        input.image ?? null,
    icon:         input.icon ?? null,
    badge:        input.badge ?? null,
    sound:        input.sound ?? null,
    deepLink:     input.deepLink ?? null,
    clickAction:  input.clickAction ?? null,
    priority:     input.priority ?? 'high',
    ttl:          input.ttl ?? 86400,
    channelId:    input.channelId ?? null,
    data:         input.data ? JSON.stringify(input.data) : null,
    targetType:   input.targetType,
    targetValue:  input.targetValue,
    status:       'queued' as const,
    sentCount:    0,
    failureCount: 0,
    openCount:    0,
    clickCount:   0,
    createdAt:    now,
    updatedAt:    now,
  }

  await db.insert(notificationCampaigns).values(newCampaign)
  return newCampaign
}

/** Get all campaigns for a project */
export async function getCampaigns(projectId: string) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(notificationCampaigns)
    .where(eq(notificationCampaigns.projectId, projectId))
    .orderBy(desc(notificationCampaigns.createdAt))

  return rows
}

/** Get single campaign by ID */
export async function getCampaignById(campaignId: string, projectId: string) {
  const db = await getDb()
  const [campaign] = await db
    .select()
    .from(notificationCampaigns)
    .where(and(eq(notificationCampaigns.id, campaignId), eq(notificationCampaigns.projectId, projectId)))
    .limit(1)

  return campaign ?? null
}

/** Update campaign status (pause, cancel, complete) */
export async function updateCampaignStatus(
  campaignId: string,
  projectId: string,
  status: 'draft' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled'
) {
  const db  = await getDb()
  const now = new Date().toISOString()

  await db
    .update(notificationCampaigns)
    .set({ status, updatedAt: now })
    .where(and(eq(notificationCampaigns.id, campaignId), eq(notificationCampaigns.projectId, projectId)))

  return { success: true, status }
}

/** Delete a campaign */
export async function deleteCampaign(campaignId: string, projectId: string) {
  const db = await getDb()
  await db
    .delete(notificationCampaigns)
    .where(and(eq(notificationCampaigns.id, campaignId), eq(notificationCampaigns.projectId, projectId)))

  return { success: true }
}
