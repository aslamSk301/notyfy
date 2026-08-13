import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { getCampaigns, createCampaign } from '@/lib/services/campaign-service'

const createCampaignSchema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1),
  title:       z.string().min(1),
  body:        z.string().min(1),
  image:       z.string().optional(),
  icon:        z.string().optional(),
  badge:       z.number().optional(),
  sound:       z.string().optional(),
  deepLink:    z.string().optional(),
  clickAction: z.string().optional(),
  priority:    z.enum(['high', 'normal']).optional(),
  ttl:         z.number().optional(),
  channelId:   z.string().optional(),
  data:        z.record(z.string(), z.unknown()).optional(),
  targetType:  z.enum(['topic', 'device', 'segment']),
  targetValue: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const campaigns = await getCampaigns(projectId)
    return NextResponse.json({ campaigns })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const body = await req.json()
    const parsed = createCampaignSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const campaign = await createCampaign(parsed.data)
    return NextResponse.json({ success: true, campaign })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
