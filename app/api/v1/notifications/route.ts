import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { sendNotificationCore } from '@/lib/send-notification-core'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS })
}

/**
 * POST /api/v1/notifications
 * OneSignal-compatible Public REST API to send push notifications from any external app.
 *
 * Auth:
 * Header: Authorization: Bearer <REST_API_KEY>  OR  x-api-key: <REST_API_KEY>
 * Body: { "apiKey": "<REST_API_KEY>" }
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, any> = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload in request body' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Extract API key
    const authHeader = req.headers.get('authorization')
    const apiKeyHeader = req.headers.get('x-api-key')
    const apiKey =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader) ||
      apiKeyHeader ||
      body.apiKey ||
      body.api_key ||
      body.rest_api_key

    const appId = body.appId || body.app_id

    if (!apiKey && !appId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Please provide your REST API Key via Bearer token, x-api-key header, or apiKey in JSON body.',
        },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const db = await getDb()

    // Prefer apiKey. If both apiKey + appId are sent, require BOTH (never OR),
    // otherwise a second project could match appId alone and return 0 devices.
    let project
    if (apiKey && appId) {
      ;[project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.apiKey, apiKey), eq(projects.appId, appId)))
        .limit(1)
    } else if (apiKey) {
      ;[project] = await db
        .select()
        .from(projects)
        .where(eq(projects.apiKey, apiKey))
        .limit(1)
    } else if (appId) {
      ;[project] = await db
        .select()
        .from(projects)
        .where(eq(projects.appId, appId))
        .limit(1)
    }

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key or App ID. Project not found.' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // Extract title & body/message
    const title = body.title
    const notificationBody = body.body || body.message

    if (!title || !notificationBody) {
      return NextResponse.json(
        { success: false, error: 'Both "title" and "body" (or "message") are required parameters.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Extract target: 'all' | 'android' | 'ios' | 'flutter' | 'react-native' | 'topic:{name}' | 'segment:{id}'
    let target = body.target || body.included_segments?.[0] || 'all'
    if (Array.isArray(target)) {
      target = target[0] || 'all'
    }

    // Handle user arrays or user target (e.g. include_external_user_ids, userIds, external_user_id, userId)
    const rawUserIds = body.include_external_user_ids ?? body.userIds ?? body.external_user_id ?? body.userId
    if (rawUserIds) {
      const userIds = Array.isArray(rawUserIds) ? rawUserIds : [rawUserIds]
      if (userIds.length > 0 && userIds[0]) {
        target = `user:${userIds[0]}`
      }
    }

    // Direct FCM tokens support (e.g. tokens, include_player_ids, player_ids)
    const directTokens = body.tokens || body.include_player_ids || body.player_ids
    let tokens: string[] | undefined = undefined
    if (Array.isArray(directTokens) && directTokens.length > 0) {
      tokens = directTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    } else if (typeof directTokens === 'string' && directTokens.trim().length > 0) {
      tokens = [directTokens.trim()]
    }

    // save_to_db flag: default true, can be set to false / transient: true to avoid writing to database
    let saveToDb = true
    if (body.save_to_db !== undefined) {
      saveToDb = body.save_to_db === true || body.save_to_db === 'true'
    } else if (body.saveToDb !== undefined) {
      saveToDb = body.saveToDb === true || body.saveToDb === 'true'
    } else if (body.transient !== undefined) {
      saveToDb = !(body.transient === true || body.transient === 'true')
    } else if (body.skip_db !== undefined) {
      saveToDb = !(body.skip_db === true || body.skip_db === 'true')
    } else if (body.log !== undefined) {
      saveToDb = body.log === true || body.log === 'true'
    }

    const targetUrl = body.url || body.deepLink || body.clickAction || body.web_url
    const imageUrl = body.imageUrl || body.image || body.iconUrl || body.icon
    const customData = body.data || {}

    // Dispatch notification core
    const result = await sendNotificationCore(
      project.userId,
      project.id,
      title,
      notificationBody,
      target,
      {
        url: targetUrl,
        imageUrl,
        data: typeof customData === 'object' ? customData : {},
        saveToDb,
        tokens,
      }
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch notification' },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: result.notificationId,
        notificationId: result.notificationId,
        recipients: result.recipientCount ?? 0,
        recipientCount: result.recipientCount ?? 0,
        savedToDb: saveToDb,
        message: saveToDb
          ? 'Notification dispatched successfully'
          : 'Notification dispatched successfully (transient / not saved to database)',
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
