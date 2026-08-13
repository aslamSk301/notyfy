export interface CampaignQueueMessage {
  campaignId:  string
  projectId:   string
  targetType:  'topic' | 'device' | 'segment'
  targetValue: string
  attempt:     number
}
