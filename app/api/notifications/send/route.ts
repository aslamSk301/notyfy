import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotificationCore } from '@/lib/send-notification-core'

/**
 * POST /api/notifications/send
 *
 * REST endpoint for programmatic sends (from CI, scripts, other services).
 * Auth: userId + projectId must match in D1.
 * Uses the same sendNotificationCore as the Server Action.
 */

const schema = z.object({
  projectId: z.string().min(1),
  title:     z.string().min(1).max(100),
  body:      z.string().min(1).max(500),
  _userId:   z.string().min(1), // passed server-side only, never from browser
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const result = await sendNotificationCore(
    parsed.data._userId,
    parsed.data.projectId,
    parsed.data.title,
    parsed.data.body
  )

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data: result })
}
