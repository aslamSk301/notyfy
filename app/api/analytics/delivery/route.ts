import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { notificationCampaigns } from '@/lib/db/schema'
import { requireSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const db = await getDb()
    const campaigns = await db
      .select({
        id:           notificationCampaigns.id,
        name:         notificationCampaigns.name,
        sentCount:    notificationCampaigns.sentCount,
        failureCount: notificationCampaigns.failureCount,
        openCount:    notificationCampaigns.openCount,
        clickCount:   notificationCampaigns.clickCount,
        createdAt:    notificationCampaigns.createdAt,
      })
      .from(notificationCampaigns)
      .where(eq(notificationCampaigns.projectId, projectId))
      .orderBy(desc(notificationCampaigns.createdAt))
      .limit(50)

    const deliveryStats = campaigns.map((c) => {
      const total = c.sentCount + c.failureCount
      return {
        ...c,
        deliveryRate: total > 0 ? Number(((c.sentCount / total) * 100).toFixed(2)) : 0,
        openRate:     c.sentCount > 0 ? Number(((c.openCount / c.sentCount) * 100).toFixed(2)) : 0,
        ctr:          c.sentCount > 0 ? Number(((c.clickCount / c.sentCount) * 100).toFixed(2)) : 0,
      }
    })

    return NextResponse.json({ deliveryStats })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
