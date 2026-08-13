import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updateDeviceToken } from '@/lib/services/device-service'

const tokenSchema = z.object({
  appId:    z.string().min(1),
  apiKey:   z.string().min(1),
  deviceId: z.string().min(1),
  fcmToken: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = tokenSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const result = await updateDeviceToken(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('Invalid appId') ? 401 : msg.includes('not found') ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
