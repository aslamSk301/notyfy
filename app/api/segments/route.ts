import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { getSegments, createSegment } from '@/lib/services/segment-service'

const ruleSchema = z.object({
  field:    z.enum(['country', 'language', 'platform', 'osVersion', 'appVersion', 'notificationPermission', 'status', 'lastOpen', 'userId']),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value:    z.string(),
})

const createSegmentSchema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1),
  description: z.string().optional(),
  rules:       z.array(ruleSchema).min(1, 'At least one filter rule is required'),
})

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const rows = await getSegments(projectId)
    return NextResponse.json({ segments: rows })
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
    const parsed = createSegmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const segment = await createSegment(parsed.data)
    return NextResponse.json({ success: true, segment })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
