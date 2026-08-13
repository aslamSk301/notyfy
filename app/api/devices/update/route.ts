import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updateDevice } from '@/lib/services/device-service'

const updateSchema = z.object({
  appId:                  z.string().min(1),
  apiKey:                 z.string().min(1),
  deviceId:               z.string().min(1),
  userId:                 z.string().optional(),
  country:                z.string().optional(),
  language:               z.string().optional(),
  appVersion:             z.string().optional(),
  osVersion:              z.string().optional(),
  deviceModel:            z.string().optional(),
  notificationPermission: z.enum(['granted', 'denied', 'default']).optional(),
  status:                 z.enum(['active', 'inactive']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const result = await updateDevice(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('Invalid appId') ? 401 : msg.includes('not found') ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
