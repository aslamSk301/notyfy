import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { deleteTopic } from '@/lib/services/topic-service'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required as query param' }, { status: 400 })
    }

    const result = await deleteTopic(id, projectId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
