import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * POST /api/device/register
 *
 * Public endpoint — authenticated by appId + apiKey.
 * Used by mobile SDKs to register or update a device FCM token.
 */

const registerSchema = z.object({
  appId: z.string().min(1, 'appId is required'),
  apiKey: z.string().min(1, 'apiKey is required'),
  fcmToken: z.string().min(1, 'fcmToken is required'),
  platform: z.enum(['android', 'ios', 'flutter', 'react-native'], {
    errorMap: () => ({ message: 'platform must be android, ios, flutter, or react-native' }),
  }),
  deviceId: z.string().min(1, 'deviceId is required'),
  appVersion: z.string().optional(),
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

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { appId, apiKey, fcmToken, platform, deviceId, appVersion } = parsed.data

  // Use admin client to bypass RLS — this is a public API authenticated by apiKey
  const supabase = createAdminClient()

  // Validate appId + apiKey
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('app_id', appId)
    .eq('api_key', apiKey)
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { success: false, error: 'Invalid appId or apiKey' },
      { status: 401 }
    )
  }

  // Upsert device — update fcmToken if device already registered
  const { error: upsertError } = await supabase
    .from('devices')
    .upsert(
      {
        project_id: project.id,
        device_id: deviceId,
        fcm_token: fcmToken,
        platform,
        app_version: appVersion ?? null,
      },
      {
        onConflict: 'project_id,device_id',
      }
    )

  if (upsertError) {
    console.error('[Device Register] Upsert error:', upsertError)
    return NextResponse.json(
      { success: false, error: 'Failed to register device' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, message: 'Device registered successfully' })
}
