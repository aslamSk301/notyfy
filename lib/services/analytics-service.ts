/**
 * Analytics and Interaction Telemetry Service
 * Aggregates subscription stats, delivery rates, open rates, CTR, and handles open/click events.
 */

import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  devices,
  notificationCampaigns,
  notificationLogs,
  notificationEvents,
} from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'

export interface RecordInteractionInput {
  notificationId?: string
  campaignId:     string
  deviceId?:       string
  userId?:         string
  eventType:      'open' | 'click'
  timestamp?:     string
}

/** Get Subscription Stats (Total, Active, Inactive) */
export async function getSubscriptionAnalytics(projectId: string) {
  const db = await getDb()

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(devices)
    .where(eq(devices.projectId, projectId))

  const [activeRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(devices)
    .where(and(eq(devices.projectId, projectId), eq(devices.status, 'active')))

  const total    = totalRow?.count ?? 0
  const active   = activeRow?.count ?? 0
  const inactive = Math.max(0, total - active)

  return {
    totalSubscriptions:    total,
    activeSubscriptions:   active,
    inactiveSubscriptions: inactive,
  }
}

/** Record user open or click telemetry event */
export async function recordNotificationEvent(input: RecordInteractionInput) {
  const db  = await getDb()
  const now = input.timestamp ?? new Date().toISOString()

  await db.insert(notificationEvents).values({
    id:             generateSecureToken(16),
    notificationId: input.notificationId ?? null,
    campaignId:     input.campaignId,
    deviceId:       input.deviceId ?? null,
    userId:         input.userId ?? null,
    eventType:      input.eventType,
    timestamp:      now,
  })

  // Increment aggregate campaign metrics
  if (input.eventType === 'open') {
    await db
      .update(notificationCampaigns)
      .set({ openCount: sql`${notificationCampaigns.openCount} + 1` })
      .where(eq(notificationCampaigns.id, input.campaignId))
  } else if (input.eventType === 'click') {
    await db
      .update(notificationCampaigns)
      .set({ clickCount: sql`${notificationCampaigns.clickCount} + 1` })
      .where(eq(notificationCampaigns.id, input.campaignId))
  }

  return { success: true }
}

/** Get detailed analytics for a campaign */
export async function getCampaignAnalytics(campaignId: string, projectId: string) {
  const db = await getDb()

  const [campaign] = await db
    .select()
    .from(notificationCampaigns)
    .where(and(eq(notificationCampaigns.id, campaignId), eq(notificationCampaigns.projectId, projectId)))
    .limit(1)

  if (!campaign) throw new Error('Campaign not found')

  const totalTargeted = campaign.sentCount + campaign.failureCount
  const deliveryRate  = totalTargeted > 0 ? (campaign.sentCount / totalTargeted) * 100 : 0
  const openRate      = campaign.sentCount > 0 ? (campaign.openCount / campaign.sentCount) * 100 : 0
  const ctr           = campaign.sentCount > 0 ? (campaign.clickCount / campaign.sentCount) * 100 : 0
  const failureRate   = totalTargeted > 0 ? (campaign.failureCount / totalTargeted) * 100 : 0

  return {
    campaignId:    campaign.id,
    name:          campaign.name,
    sentCount:     campaign.sentCount,
    failureCount:  campaign.failureCount,
    openCount:     campaign.openCount,
    clickCount:    campaign.clickCount,
    deliveryRate:  Number(deliveryRate.toFixed(2)),
    openRate:      Number(openRate.toFixed(2)),
    ctr:           Number(ctr.toFixed(2)),
    failureRate:   Number(failureRate.toFixed(2)),
  }
}
