import { NextRequest, NextResponse } from 'next/server'
import { eq, or } from 'drizzle-orm'
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

    // Find project by apiKey or appId
    const conditions = []
    if (apiKey) conditions.push(eq(projects.apiKey, apiKey))
    if (appId) conditions.push(eq(projects.appId, appId))

    const [project] = await db
      .select()
      .from(projects)
      .where(or(...conditions))
      .limit(1)

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

    // Handle user arrays or user target
    if (body.include_external_user_ids || body.userIds) {
      const userIds = body.include_external_user_ids || body.userIds
      if (Array.isArray(userIds) && userIds.length > 0) {
        target = `user:${userIds[0]}`
      }
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
        message: 'Notification dispatched successfully',
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
