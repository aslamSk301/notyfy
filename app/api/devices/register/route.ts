import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registerDevice } from '@/lib/services/device-service'

const registerSchema = z.object({
  appId:                  z.string().min(1, 'appId is required'),
  apiKey:                 z.string().min(1, 'apiKey is required'),
  fcmToken:               z.string().min(1, 'fcmToken is required'),
  platform:               z.enum(['android', 'ios']),
  deviceId:               z.string().min(1, 'deviceId is required'),
  userId:                 z.string().optional(),
  country:                z.string().optional(),
  language:               z.string().optional(),
  appVersion:             z.string().optional(),
  osVersion:              z.string().optional(),
  deviceModel:            z.string().optional(),
  notificationPermission: z.enum(['granted', 'denied', 'default']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const result = await registerDevice(parsed.data)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('Invalid appId') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
