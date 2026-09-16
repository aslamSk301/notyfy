'use server'

import { eq, inArray, sql } from 'drizzle-orm'
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

const PAGE_SIZE = 20

export async function getAllDevices(opts?: { page?: number; pageSize?: number }) {
  try {
    const session = await requireSession()
    const db      = await getDb()

    const pageSize = Math.min(Math.max(opts?.pageSize ?? PAGE_SIZE, 1), 100)
    const page = Math.max(opts?.page ?? 1, 1)
    const offset = (page - 1) * pageSize

    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.userId))

    if (userProjects.length === 0) {
      return { devices: [], total: 0, page: 1, pageSize, totalPages: 0 }
    }

    const projectIds = userProjects.map((p) => p.id)
    const projectMap = Object.fromEntries(userProjects.map((p) => [p.id, p.name]))

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(devices)
      .where(inArray(devices.projectId, projectIds))

    const total = Number(countRow?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const deviceRows = await db
      .select()
      .from(devices)
      .where(inArray(devices.projectId, projectIds))
      .orderBy(sql`coalesce(${devices.lastActive}, ${devices.createdAt}) desc`)
      .limit(pageSize)
      .offset(offset)

    if (deviceRows.length === 0) {
      return { devices: [], total, page, pageSize, totalPages }
    }

    const deviceIds = deviceRows.map((d) => d.id)
    const assignments = await db
      .select({
        deviceId: deviceTopics.deviceId,
        topicName: topics.name,
      })
      .from(deviceTopics)
      .innerJoin(topics, eq(deviceTopics.topicId, topics.id))
      .where(inArray(deviceTopics.deviceId, deviceIds))

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

    return { devices: enriched, total, page, pageSize, totalPages }
  } catch (e) {
    return {
      devices: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: 0,
      error: (e as Error).message,
    }
  }
}
