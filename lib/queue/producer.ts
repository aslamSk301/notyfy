/**
 * Cloudflare Queues Producer
 * Enqueues notification campaign execution tasks for asynchronous processing.
 */

import { processCampaignQueueJob } from './consumer'
import type { CampaignQueueMessage } from './types'

export type { CampaignQueueMessage }

export async function enqueueCampaignJob(
  env: { CAMPAIGN_QUEUE?: Queue<CampaignQueueMessage> },
  message: CampaignQueueMessage
) {
  if (env.CAMPAIGN_QUEUE) {
    await env.CAMPAIGN_QUEUE.send(message)
    return { queued: true }
  }

  // Fallback: synchronous inline execution if queue binding is not present (e.g. local dev fallback)
  await processCampaignQueueJob(message)
  return { queued: false, inline: true }
}
