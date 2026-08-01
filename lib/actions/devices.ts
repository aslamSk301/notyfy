'use server'

import { eq, inArray, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, deviceTopics, topics } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'

export interface DeviceWithTopics {
  id:                 string
  deviceId:           string
  fcmToken:           string
  platform:           string
  appVersion:         string | null
  deviceModel:        string | null
  deviceOs:           string | null
  language:           string | null
  timezone:           string | null
  externalUserId:     string | null
  sdkVersion:         string | null
  subscriptionStatus: string
  lastActive:         string | null
  createdAt:          string
  projectName:        string
  projectId:          string
  topicNames:         string[]
}

export async function getAllDevices() {
  try {
    const session = await requireSession()
    const db      = await getDb()

    // Get user's projects
    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) return { devices: [] }

    const projectIds = userProjects.map((p) => p.id)
    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))

    // Get all devices
    const deviceRows = await db
      .select()
      .from(devices)
      .where(inArray(devices.projectId, projectIds))
      .orderBy(desc(devices.lastActive))

    if (deviceRows.length === 0) return { devices: [] }

    // Get device-topic assignments
    const deviceIds = deviceRows.map((d) => d.id)
    const assignments = await db
      .select({
        deviceId: deviceTopics.deviceId,
        topicName: topics.name,
      })
      .from(deviceTopics)
      .innerJoin(topics, eq(deviceTopics.topicId, topics.id))
      .where(inArray(deviceTopics.deviceId, deviceIds))

    // Map topics per device
    const topicsMap: Record<string, string[]> = {}
    for (const a of assignments) {
      if (!topicsMap[a.deviceId]) topicsMap[a.deviceId] = []
      topicsMap[a.deviceId].push(a.topicName)
    }

    const enriched: DeviceWithTopics[] = deviceRows.map((d) => ({
      id:                 d.id,
      deviceId:           d.deviceId,
      fcmToken:           d.fcmToken,
      platform:           d.platform,
      appVersion:         d.appVersion,
      deviceModel:        d.deviceModel,
      deviceOs:           d.deviceOs,
      language:           d.language,
      timezone:           d.timezone,
      externalUserId:     d.externalUserId,
      sdkVersion:         d.sdkVersion,
      subscriptionStatus: d.subscriptionStatus,
      lastActive:         d.lastActive,
      createdAt:          d.createdAt,
      projectName:        projectMap[d.projectId] ?? '—',
      projectId:          d.projectId,
      topicNames:         topicsMap[d.id] ?? [],
    }))

    return { devices: enriched }
  } catch (e) {
    return { devices: [], error: (e as Error).message }
  }
}
