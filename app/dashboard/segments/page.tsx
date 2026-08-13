import { getAllSegments, getAudienceRecords } from '@/lib/actions/segments'
import { SegmentsManager } from '@/components/segments/segments-manager'

export const dynamic = 'force-dynamic'

export default async function SegmentsPage() {
  const { segments = [], projects = [] } = await getAllSegments()
  const { records = [] } = await getAudienceRecords()

  return (
    <div className="container mx-auto py-6">
      <SegmentsManager initialSegments={segments} projects={projects} records={records} />
    </div>
  )
}
