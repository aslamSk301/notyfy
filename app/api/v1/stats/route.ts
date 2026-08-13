import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices } from '@/lib/db/schema'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS })
}

/**
 * GET /api/v1/stats
 * Get subscriber statistics for the authenticated project.
 */
export async function GET(req: NextRequest) {
  try {
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

    const [totalUsers] = await db
      .select({ total: count() })
      .from(devices)
      .where(eq(devices.projectId, project.id))

    return NextResponse.json(
      {
        success: true,
        stats: {
          name: project.name,
          appId: project.appId,
          totalUsers: totalUsers?.total ?? 0,
        },
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
