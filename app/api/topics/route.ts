import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { getTopics, createTopic } from '@/lib/services/topic-service'

const createTopicSchema = z.object({
  projectId:   z.string().min(1, 'projectId is required'),
  name:        z.string().min(1, 'name is required'),
  type:        z.enum(['system', 'custom']).optional(),
  description: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const rows = await getTopics(projectId)
    return NextResponse.json({ topics: rows })
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
    const parsed = createTopicSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
    }

    const topic = await createTopic(parsed.data)
    return NextResponse.json({ success: true, topic })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
