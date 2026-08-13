import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getSubscriptionAnalytics } from '@/lib/services/analytics-service'

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const stats = await getSubscriptionAnalytics(projectId)
    return NextResponse.json(stats)
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
