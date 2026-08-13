import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordNotificationEvent } from '@/lib/services/analytics-service'

const eventSchema = z.object({
  notificationId: z.string().optional(),
  campaignId:     z.string().min(1, 'campaignId is required'),
  deviceId:       z.string().optional(),
  userId:         z.string().optional(),
  timestamp:      z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = eventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const result = await recordNotificationEvent({ ...parsed.data, eventType: 'click' })
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
