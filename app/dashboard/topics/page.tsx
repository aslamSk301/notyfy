import { getProjects } from '@/lib/actions/projects'
import { getAllTopics } from '@/lib/actions/topics'
import { TopicsManager } from '@/components/topics/topics-manager'
import { Tags } from 'lucide-react'

export const metadata = { title: 'Topics' }

export default async function TopicsPage() {
  const [{ projects }, { topics }] = await Promise.all([
    getProjects(),
    getAllTopics(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Topics</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Create topics — assign devices, then send targeted notifications with a single FCM call.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
          <Tags className="h-4 w-4 text-[var(--primary)]" />
          How Topics Work
        </p>
        <ol className="space-y-1.5 text-xs text-[var(--muted-foreground)] list-decimal list-inside">
          <li>Create a topic (e.g. <code className="bg-[var(--muted)] px-1 rounded">cricket</code>)</li>
          <li>Click <strong>Assign All</strong> — all project devices get subscribed to the topic via FCM</li>
          <li>Or app auto-subscribes on open: <code className="bg-[var(--muted)] px-1 rounded">NotifyMVP.subscribeToTopic('cricket')</code></li>
          <li>Dashboard → Send to <strong>topic:cricket</strong> → 1 FCM call → all subscribers receive it instantly</li>
        </ol>
        <div className="mt-2 rounded bg-[var(--muted)] p-2 text-xs text-[var(--muted-foreground)]">
          ⚡ <strong>All devices</strong> and <strong>Platform</strong> targets use FCM topics automatically —
          devices auto-subscribe on app open. No DB token loop needed.
        </div>
      </div>

      <TopicsManager
        projects={projects}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        topics={topics as any}
      />
    </div>
  )
}
