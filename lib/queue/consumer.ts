/**
 * Cloudflare Queue Consumer / Worker Processor
 * Executes push notification campaigns asynchronously without blocking HTTP requests.
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { notificationCampaigns, projects, devices, notificationLogs } from '@/lib/db/schema'
import { downloadFromR2 } from '@/lib/r2/client'
import {
  sendFcmTopicNotification,
  sendFcmTokenNotification,
  type FirebaseServiceAccount,
} from '@/lib/firebase/fcm-client'
import { classifyFcmError } from '@/lib/firebase/error-handler'
import { querySegmentDeviceTokens } from '@/lib/services/segment-service'
import { generateSecureToken } from '@/lib/utils'
import type { CampaignQueueMessage } from './types'

export async function processCampaignQueueJob(job: CampaignQueueMessage) {
  const db  = await getDb()
  const now = new Date().toISOString()

  // 1. Fetch campaign
  const [campaign] = await db
    .select()
    .from(notificationCampaigns)
    .where(eq(notificationCampaigns.id, job.campaignId))
    .limit(1)

  if (!campaign || campaign.status === 'cancelled' || campaign.status === 'paused') {
    return
  }

  // Update status to processing
  await db
    .update(notificationCampaigns)
    .set({ status: 'processing', updatedAt: now })
    .where(eq(notificationCampaigns.id, campaign.id))

  // 2. Fetch project credentials
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, campaign.projectId))
    .limit(1)

  if (!project || !project.firebaseJsonPath) {
    await db
      .update(notificationCampaigns)
      .set({ status: 'failed', updatedAt: now })
      .where(eq(notificationCampaigns.id, campaign.id))
    return
  }

  // Download Firebase credentials from R2
  const credentialsJson = await downloadFromR2(project.firebaseJsonPath)
  if (!credentialsJson) {
    await db
      .update(notificationCampaigns)
      .set({ status: 'failed', updatedAt: now })
      .where(eq(notificationCampaigns.id, campaign.id))
    return
  }

  const credentials = JSON.parse(credentialsJson) as FirebaseServiceAccount

  const payloadData = campaign.data ? JSON.parse(campaign.data) : {}

  let sentSuccessCount = 0
  let sentFailureCount = 0

  // ── 3A. TOPIC TARGET (Large Broadcast — O(1) D1 Load) ────────────────────
  if (campaign.targetType === 'topic') {
    const topicResult = await sendFcmTopicNotification(credentials, {
      topic:       campaign.targetValue,
      title:       campaign.title,
      body:        campaign.body,
      image:       campaign.image ?? undefined,
      icon:        campaign.icon ?? undefined,
      badge:       campaign.badge ?? undefined,
      sound:       campaign.sound ?? undefined,
      deepLink:    campaign.deepLink ?? undefined,
      clickAction: campaign.clickAction ?? undefined,
      channelId:   campaign.channelId ?? undefined,
      priority:    campaign.priority as 'high' | 'normal',
      ttl:         campaign.ttl,
      data:        payloadData,
    })

    if (topicResult.success) {
      sentSuccessCount = 1
    } else {
      sentFailureCount = 1
    }

    // Record log entry
    await db.insert(notificationLogs).values({
      id:          generateSecureToken(16),
      campaignId:  campaign.id,
      deviceId:    null,
      fcmToken:    `topic:${campaign.targetValue}`,
      status:      topicResult.success ? 'sent' : 'failed',
      errorCode:   topicResult.errorCode ?? null,
      sentAt:      now,
      createdAt:   now,
    })
  }

  // ── 3B. DEVICE TARGET (Direct Token Push) ───────────────────────────────
  else if (campaign.targetType === 'device') {
    // targetValue can be subscriptionId or fcmToken or userId
    const [targetDevice] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.projectId, project.id), eq(devices.id, campaign.targetValue)))
      .limit(1)

    const token = targetDevice?.fcmToken ?? campaign.targetValue

    const tokenResult = await sendFcmTokenNotification(credentials, {
      token,
      title:       campaign.title,
      body:        campaign.body,
      image:       campaign.image ?? undefined,
      icon:        campaign.icon ?? undefined,
      badge:       campaign.badge ?? undefined,
      sound:       campaign.sound ?? undefined,
      deepLink:    campaign.deepLink ?? undefined,
      clickAction: campaign.clickAction ?? undefined,
      channelId:   campaign.channelId ?? undefined,
      priority:    campaign.priority as 'high' | 'normal',
      ttl:         campaign.ttl,
      data:        payloadData,
    })

    if (tokenResult.success) {
      sentSuccessCount = 1
    } else {
      sentFailureCount = 1
      if (tokenResult.isPermanent && targetDevice) {
        // Mark token inactive
        await db
          .update(devices)
          .set({ status: 'inactive', inactiveAt: now, updatedAt: now })
          .where(eq(devices.id, targetDevice.id))
      }
    }

    await db.insert(notificationLogs).values({
      id:          generateSecureToken(16),
      campaignId:  campaign.id,
      deviceId:    targetDevice?.id ?? null,
      fcmToken:    token,
      status:      tokenResult.success ? 'sent' : 'failed',
      errorCode:   tokenResult.errorCode ?? null,
      sentAt:      now,
      createdAt:   now,
    })
  }

  // ── 3C. SEGMENT TARGET (Dynamic Filter Batching) ────────────────────────
  else if (campaign.targetType === 'segment') {
    const targetDevices = await querySegmentDeviceTokens(project.id, campaign.targetValue)

    for (const dev of targetDevices) {
      const res = await sendFcmTokenNotification(credentials, {
        token:       dev.fcmToken,
        title:       campaign.title,
        body:        campaign.body,
        image:       campaign.image ?? undefined,
        icon:        campaign.icon ?? undefined,
        badge:       campaign.badge ?? undefined,
        sound:       campaign.sound ?? undefined,
        deepLink:    campaign.deepLink ?? undefined,
        clickAction: campaign.clickAction ?? undefined,
        channelId:   campaign.channelId ?? undefined,
        priority:    campaign.priority as 'high' | 'normal',
        ttl:         campaign.ttl,
        data:        payloadData,
      })

      if (res.success) {
        sentSuccessCount++
      } else {
        sentFailureCount++
        if (res.isPermanent) {
          // Deactivate token in D1
          await db
            .update(devices)
            .set({ status: 'inactive', inactiveAt: now, updatedAt: now })
            .where(eq(devices.id, dev.id))
        }
      }

      await db.insert(notificationLogs).values({
        id:          generateSecureToken(16),
        campaignId:  campaign.id,
        deviceId:    dev.id,
        fcmToken:    dev.fcmToken,
        status:      res.success ? 'sent' : 'failed',
        errorCode:   res.errorCode ?? null,
        sentAt:      now,
        createdAt:   now,
      })
    }
  }

  // 4. Update Campaign Final Metrics & Status
  await db
    .update(notificationCampaigns)
    .set({
      status:       'completed',
      sentCount:    sentSuccessCount,
      failureCount: sentFailureCount,
      updatedAt:    new Date().toISOString(),
    })
    .where(eq(notificationCampaigns.id, campaign.id))
}
