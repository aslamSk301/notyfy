/**
 * Device Subscription Service (OneSignal Parity)
 * Manages device registration, FCM token refreshes, metadata updates, and heartbeats.
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'
import { buildSystemTopicNames } from '@/lib/utils/topic-normalizer'
import { syncDeviceSystemTopics } from '@/lib/services/topic-sync'
import type {
  RegisterDeviceInput,
  UpdateDeviceInput,
  UpdateDeviceTokenInput,
  DeviceHeartbeatInput,
} from '@/types/onesignal'

/** Helper to authenticate public API calls via appId + apiKey */
export async function authenticateApp(appId: string, apiKey: string) {
  const db = await getDb()
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.appId, appId), eq(projects.apiKey, apiKey)))
    .limit(1)

  if (!project) throw new Error('Invalid appId or apiKey')
  return project
}

/** Register or update a device subscription */
export async function registerDevice(input: RegisterDeviceInput) {
  const project = await authenticateApp(input.appId, input.apiKey)
  const db      = await getDb()
  const now     = new Date().toISOString()

  // 1. Check if deviceId already exists for this project
  const [existingDevice] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, input.deviceId)))
    .limit(1)

  // 2. Check if another device has the exact same FCM token (duplicate token detection)
  const [tokenHolder] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.fcmToken, input.fcmToken)))
    .limit(1)

  let subscriptionId = existingDevice?.id ?? tokenHolder?.id ?? generateSecureToken(16)

  const payload = {
    projectId:              project.id,
    userId:                 input.userId ?? existingDevice?.userId ?? null,
    deviceId:               input.deviceId,
    fcmToken:               input.fcmToken,
    platform:               input.platform,
    country:                input.country?.toUpperCase() ?? existingDevice?.country ?? null,
    language:               input.language?.toLowerCase() ?? existingDevice?.language ?? null,
    appVersion:             input.appVersion ?? existingDevice?.appVersion ?? null,
    osVersion:              input.osVersion ?? existingDevice?.osVersion ?? null,
    deviceModel:            input.deviceModel ?? existingDevice?.deviceModel ?? null,
    notificationPermission: input.notificationPermission ?? existingDevice?.notificationPermission ?? 'granted',
    status:                 'active' as const,
    lastOpen:               now,
    lastTokenUpdate:        now,
    inactiveAt:             null,
    updatedAt:              now,
  }

  if (existingDevice || tokenHolder) {
    await db.update(devices).set(payload).where(eq(devices.id, subscriptionId))
  } else {
    await db.insert(devices).values({
      id: subscriptionId,
      createdAt: now,
      ...payload,
    })
  }

  let systemTopics: string[] = []
  try {
    systemTopics = await syncDeviceSystemTopics({
      projectId:        project.id,
      appId:            project.appId,
      dbDeviceId:       subscriptionId,
      fcmToken:         payload.fcmToken,
      previousToken:    existingDevice?.fcmToken ?? tokenHolder?.fcmToken,
      firebaseJsonPath: project.firebaseJsonPath,
      next: {
        platform:   payload.platform,
        deviceOs:   payload.osVersion,
        country:    payload.country,
        language:   payload.language,
        appVersion: payload.appVersion,
      },
      previous: existingDevice
        ? {
            platform:   existingDevice.platform,
            deviceOs:   existingDevice.deviceOs ?? existingDevice.osVersion,
            country:    existingDevice.country,
            language:   existingDevice.language,
            appVersion: existingDevice.appVersion,
          }
        : null,
    })
  } catch (err) {
    console.error('[Topics] register sync failed:', err)
    systemTopics = buildSystemTopicNames(project.appId, {
      platform: payload.platform,
      country: payload.country,
      language: payload.language,
      appVersion: payload.appVersion,
    })
  }

  return {
    subscriptionId,
    status: 'active' as const,
    topics: systemTopics,
  }
}

/** Update existing device subscription metadata */
export async function updateDevice(input: UpdateDeviceInput) {
  const project = await authenticateApp(input.appId, input.apiKey)
  const db      = await getDb()
  const now     = new Date().toISOString()

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, input.deviceId)))
    .limit(1)

  if (!device) throw new Error('Device subscription not found')

  const updateData: Partial<typeof devices.$inferInsert> = {
    updatedAt: now,
  }

  if (input.userId !== undefined) updateData.userId = input.userId
  if (input.country !== undefined) updateData.country = input.country.toUpperCase()
  if (input.language !== undefined) updateData.language = input.language.toLowerCase()
  if (input.appVersion !== undefined) updateData.appVersion = input.appVersion
  if (input.osVersion !== undefined) updateData.osVersion = input.osVersion
  if (input.deviceModel !== undefined) updateData.deviceModel = input.deviceModel
  if (input.notificationPermission !== undefined) updateData.notificationPermission = input.notificationPermission
  if (input.status !== undefined) {
    updateData.status = input.status
    if (input.status === 'inactive') updateData.inactiveAt = now
  }

  await db.update(devices).set(updateData).where(eq(devices.id, device.id))

  try {
    await syncDeviceSystemTopics({
      projectId:        project.id,
      appId:            project.appId,
      dbDeviceId:       device.id,
      fcmToken:         device.fcmToken,
      firebaseJsonPath: project.firebaseJsonPath,
      next: {
        platform:   device.platform,
        deviceOs:   updateData.osVersion ?? device.deviceOs ?? device.osVersion,
        country:    updateData.country ?? device.country,
        language:   updateData.language ?? device.language,
        appVersion: updateData.appVersion ?? device.appVersion,
      },
      previous: {
        platform:   device.platform,
        deviceOs:   device.deviceOs ?? device.osVersion,
        country:    device.country,
        language:   device.language,
        appVersion: device.appVersion,
      },
    })
  } catch (err) {
    console.error('[Topics] update sync failed:', err)
  }

  return { success: true, subscriptionId: device.id }
}

/** Handle FCM token refresh */
export async function updateDeviceToken(input: UpdateDeviceTokenInput) {
  const project = await authenticateApp(input.appId, input.apiKey)
  const db      = await getDb()
  const now     = new Date().toISOString()

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, input.deviceId)))
    .limit(1)

  if (!device) throw new Error('Device subscription not found')

  const oldToken = device.fcmToken

  await db.update(devices).set({
    fcmToken:        input.fcmToken,
    status:          'active',
    inactiveAt:      null,
    lastTokenUpdate: now,
    updatedAt:       now,
  }).where(eq(devices.id, device.id))

  try {
    await syncDeviceSystemTopics({
      projectId:        project.id,
      appId:            project.appId,
      dbDeviceId:       device.id,
      fcmToken:         input.fcmToken,
      previousToken:    oldToken,
      firebaseJsonPath: project.firebaseJsonPath,
      next: {
        platform:   device.platform,
        deviceOs:   device.deviceOs ?? device.osVersion,
        country:    device.country,
        language:   device.language,
        appVersion: device.appVersion,
      },
      previous: {
        platform:   device.platform,
        deviceOs:   device.deviceOs ?? device.osVersion,
        country:    device.country,
        language:   device.language,
        appVersion: device.appVersion,
      },
    })
  } catch (err) {
    console.error('[Topics] token sync failed:', err)
  }

  return { success: true, subscriptionId: device.id }
}

/** Record app heartbeat (lastOpen tracking) */
export async function recordHeartbeat(input: DeviceHeartbeatInput) {
  const project = await authenticateApp(input.appId, input.apiKey)
  const db      = await getDb()
  const now     = new Date().toISOString()

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.projectId, project.id), eq(devices.deviceId, input.deviceId)))
    .limit(1)

  if (!device) throw new Error('Device subscription not found')

  await db.update(devices).set({
    lastOpen:  now,
    updatedAt: now,
  }).where(eq(devices.id, device.id))

  return { success: true, lastOpen: now }
}

/** Deactivate a device subscription */
export async function deactivateDevice(subscriptionId: string, projectId: string) {
  const db  = await getDb()
  const now = new Date().toISOString()

  await db.update(devices).set({
    status:     'inactive',
    inactiveAt: now,
    updatedAt:  now,
  }).where(and(eq(devices.id, subscriptionId), eq(devices.projectId, projectId)))

  return { success: true }
}
