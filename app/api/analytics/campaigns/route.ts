import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getCampaignAnalytics } from '@/lib/services/analytics-service'

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const campaignId = req.nextUrl.searchParams.get('campaignId')
    const projectId  = req.nextUrl.searchParams.get('projectId')

    if (!campaignId || !projectId) {
      return NextResponse.json({ error: 'campaignId and projectId are required' }, { status: 400 })
    }

    const analytics = await getCampaignAnalytics(campaignId, projectId)
    return NextResponse.json({ analytics })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
