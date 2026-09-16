/**
 * Shared helpers for /api/v1/* public REST endpoints (apiKey auth + CORS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'

export const V1_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

export function v1Json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: V1_CORS_HEADERS })
}

export function extractApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  const apiKeyHeader = req.headers.get('x-api-key')
  const fromAuth =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader
  const key = fromAuth || apiKeyHeader
  return key?.trim() || null
}

export async function authenticateV1Project(req: NextRequest) {
  const apiKey = extractApiKey(req)
  if (!apiKey) {
    return {
      error: v1Json(
        {
          success: false,
          error:
            'Authorization required. Use Authorization: Bearer <apiKey> or x-api-key header.',
        },
        401
      ),
    }
  }

  const db = await getDb()
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      appId: projects.appId,
      userId: projects.userId,
      firebaseJsonPath: projects.firebaseJsonPath,
    })
    .from(projects)
    .where(eq(projects.apiKey, apiKey))
    .limit(1)

  if (!project) {
    return {
      error: v1Json({ success: false, error: 'Invalid API Key' }, 401),
    }
  }

  return { project, db, apiKey }
}

/** Mask FCM token for public API responses (never return full token). */
export function maskFcmToken(token: string | null | undefined): string | null {
  if (!token) return null
  if (token.startsWith('pending_')) return null
  if (token.length <= 12) return '••••••••'
  return `…${token.slice(-8)}`
}
