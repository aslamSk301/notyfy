import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getSegmentById, deleteSegment } from '@/lib/services/segment-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params
    const segment = await getSegmentById(id)

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    return NextResponse.json({ segment })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

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

    const result = await deleteSegment(id, projectId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
