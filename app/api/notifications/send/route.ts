import { NextRequest, NextResponse } from 'next/server'
import { sendNotificationCore } from '@/lib/send-notification-core'
import { z } from 'zod'

/**
 * POST /api/notifications/send
 *
 * External REST endpoint — for programmatic sends (e.g. from CI, scripts).
 * Auth: projectId + userId passed in body (must match in DB).
 * Uses the same sendNotificationCore as the Server Action — no duplication.
 */

const sendSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  _userId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(body)
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
    parsed.data.body,
  )

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result })
}
