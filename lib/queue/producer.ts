/**
 * Cloudflare Queues Producer
 * Enqueues notification campaign execution tasks for asynchronous processing.
 */

export interface CampaignQueueMessage {
  campaignId:  string
  projectId:   string
  targetType:  'topic' | 'device' | 'segment'
  targetValue: string
  attempt:     number
}

export async function enqueueCampaignJob(
  env: { CAMPAIGN_QUEUE?: Queue<CampaignQueueMessage> },
  message: CampaignQueueMessage
) {
  if (env.CAMPAIGN_QUEUE) {
    await env.CAMPAIGN_QUEUE.send(message)
    return { queued: true }
  }

  // Fallback: synchronous inline execution if queue binding is not present (e.g. local dev fallback)
  const { processCampaignQueueJob } = await import('./consumer')
  await processCampaignQueueJob(message)
  return { queued: false, inline: true }
}
