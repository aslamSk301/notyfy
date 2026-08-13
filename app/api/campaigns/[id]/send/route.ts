import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getCampaignById, updateCampaignStatus } from '@/lib/services/campaign-service'
import { enqueueCampaignJob } from '@/lib/queue/producer'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params
    const body = (await req.json()) as { projectId?: string }
    const projectId = body.projectId

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const campaign = await getCampaignById(id, projectId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Mark as queued
    await updateCampaignStatus(id, projectId, 'queued')

    // Enqueue for async execution
    const queueRes = await enqueueCampaignJob(
      {},
      {
        campaignId:  campaign.id,
        projectId:   campaign.projectId,
        targetType:  campaign.targetType as 'topic' | 'device' | 'segment',
        targetValue: campaign.targetValue,
        attempt:     1,
      }
    )

    return NextResponse.json({ success: true, message: 'Campaign dispatch started', ...queueRes })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes('authenticated') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
