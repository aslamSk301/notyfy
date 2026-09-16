import { NextRequest } from 'next/server'
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { devices, deviceTopics, topics } from '@/lib/db/schema'
import {
  V1_CORS_HEADERS,
  authenticateV1Project,
  maskFcmToken,
  v1Json,
} from '@/lib/api/v1-auth'

export async function OPTIONS() {
  return v1Json({}, 200)
}

/**
 * GET /api/v1/devices
 *
 * List devices for the authenticated project (custom dashboard).
 *
 * Auth: Authorization: Bearer <apiKey>  OR  x-api-key: <apiKey>
 *
 * Query (optional):
 *   platform=android|ios|flutter|react-native
 *   status=active|inactive|subscribed|unsubscribed
 *   externalUserId=...
 *   country=IN
 *   language=en
 *   appVersion=2.2.19
 *   limit=20 (max 200, default 20)
 *   offset=0
 *   page=1 (optional; overrides offset as (page-1)*limit)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateV1Project(req)
    if ('error' in auth && auth.error) return auth.error

    const { project, db } = auth
    const sp = req.nextUrl.searchParams

    const platform = sp.get('platform')?.trim()
    const status = sp.get('status')?.trim()
    const externalUserId = sp.get('externalUserId')?.trim() || sp.get('userId')?.trim()
    const country = sp.get('country')?.trim()
    const language = sp.get('language')?.trim()
    const appVersion = sp.get('appVersion')?.trim()
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 200)
    const pageParam = parseInt(sp.get('page') || '', 10)
    const offset = Number.isFinite(pageParam) && pageParam >= 1
      ? (pageParam - 1) * limit
      : Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0)

    const conditions: SQL[] = [eq(devices.projectId, project.id)]

    if (platform) {
      const allowed = ['android', 'ios', 'flutter', 'react-native'] as const
      if ((allowed as readonly string[]).includes(platform)) {
        conditions.push(eq(devices.platform, platform as (typeof allowed)[number]))
      }
    }
    if (country) conditions.push(eq(devices.country, country.toUpperCase()))
    if (language) conditions.push(eq(devices.language, language.toLowerCase()))
    if (appVersion) conditions.push(eq(devices.appVersion, appVersion))
    if (externalUserId) {
      conditions.push(
        or(
          eq(devices.externalUserId, externalUserId),
          eq(devices.userId, externalUserId)
        )!
      )
    }
    if (status === 'active' || status === 'inactive') {
      conditions.push(eq(devices.status, status))
    } else if (status === 'subscribed' || status === 'unsubscribed') {
      conditions.push(eq(devices.subscriptionStatus, status))
    }

    const whereClause = and(...conditions)

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(devices)
      .where(whereClause)

    const total = Number(countRow?.total ?? 0)

    const rows = await db
      .select({
        id: devices.id,
        deviceId: devices.deviceId,
        fcmToken: devices.fcmToken,
        platform: devices.platform,
        appVersion: devices.appVersion,
        deviceModel: devices.deviceModel,
        deviceOs: devices.deviceOs,
        osVersion: devices.osVersion,
        country: devices.country,
        language: devices.language,
        timezone: devices.timezone,
        externalUserId: devices.externalUserId,
        userId: devices.userId,
        sdkVersion: devices.sdkVersion,
        subscriptionStatus: devices.subscriptionStatus,
        status: devices.status,
        notificationPermission: devices.notificationPermission,
        lastActive: devices.lastActive,
        lastOpen: devices.lastOpen,
        createdAt: devices.createdAt,
        updatedAt: devices.updatedAt,
      })
      .from(devices)
      .where(whereClause)
      .orderBy(sql`coalesce(${devices.lastActive}, ${devices.createdAt}) desc`)
      .limit(limit)
      .offset(offset)

    const ids = rows.map((r) => r.id)
    const topicsMap: Record<string, string[]> = {}

    if (ids.length > 0) {
      const assignments = await db
        .select({
          deviceId: deviceTopics.deviceId,
          topicName: topics.name,
        })
        .from(deviceTopics)
        .innerJoin(topics, eq(deviceTopics.topicId, topics.id))
        .where(inArray(deviceTopics.deviceId, ids))

      for (const a of assignments) {
        if (!topicsMap[a.deviceId]) topicsMap[a.deviceId] = []
        topicsMap[a.deviceId].push(a.topicName)
      }
    }

    const list = rows.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      fcmTokenMasked: maskFcmToken(d.fcmToken),
      platform: d.platform,
      appVersion: d.appVersion,
      deviceModel: d.deviceModel,
      deviceOs: d.deviceOs ?? d.osVersion,
      country: d.country,
      language: d.language,
      timezone: d.timezone,
      externalUserId: d.externalUserId ?? d.userId,
      sdkVersion: d.sdkVersion,
      subscriptionStatus: d.subscriptionStatus,
      status: d.status,
      notificationPermission: d.notificationPermission,
      topics: topicsMap[d.id] ?? [],
      lastActive: d.lastActive,
      lastOpen: d.lastOpen,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))

    const page = Math.floor(offset / limit) + 1
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

    return v1Json({
      success: true,
      project: { id: project.id, name: project.name, appId: project.appId },
      total,
      limit,
      offset,
      page,
      totalPages,
      devices: list,
    })
  } catch (err) {
    return v1Json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      500
    )
  }
}

// Re-export CORS for wrangler / tooling that inspects the module
export { V1_CORS_HEADERS }
