import { NextRequest, NextResponse } from 'next/server'
import { eq, or, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, notifications } from '@/lib/db/schema'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS })
}

/**
 * GET /api/v1/notifications/[id]
 * Fetch status & metrics of a sent notification.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authHeader = req.headers.get('authorization')
    const apiKeyHeader = req.headers.get('x-api-key')
    const apiKey =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader) ||
      apiKeyHeader

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Authorization header or x-api-key required' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const db = await getDb()

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, apiKey))
      .limit(1)

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Invalid API Key' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.projectId, project.id)))
      .limit(1)

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: notification.id,
        title: notification.title,
        body: notification.body,
        status: notification.status,
        recipients: notification.recipientCount,
        openCount: notification.openCount,
        clickCount: notification.clickCount,
        createdAt: notification.createdAt,
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
