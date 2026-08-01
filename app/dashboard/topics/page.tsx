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
          Create topics — users subscribe via the mobile SDK and receive targeted notifications.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
          <Tags className="h-4 w-4 text-[var(--primary)]" />
          How Dynamic Topics Work
        </p>
        <ol className="space-y-1.5 text-xs text-[var(--muted-foreground)] list-decimal list-inside">
          <li>Create a topic here (e.g. <code className="bg-[var(--muted)] px-1 rounded">cricket</code>, <code className="bg-[var(--muted)] px-1 rounded">breaking_news</code>)</li>
          <li>Your mobile app calls <code className="bg-[var(--muted)] px-1 rounded">GET /api/topics?appId=&apiKey=</code> to fetch all topics</li>
          <li>Show users a settings screen with topic toggles</li>
          <li>On toggle → SDK calls subscribe/unsubscribe API</li>
          <li>Send from dashboard using <strong>Topic</strong> selector — only subscribers receive it</li>
        </ol>
        <div className="mt-3 rounded-md bg-[var(--muted)] p-3">
          <p className="text-xs font-medium text-[var(--foreground)] mb-1">Flutter SDK usage:</p>
          <pre className="text-xs text-[var(--primary)] overflow-x-auto"><code>{`// Fetch topics from backend
final topics = await NotifyMVP.fetchTopics();

// User toggles on
await NotifyMVP.subscribeToTopic('cricket');

// User toggles off
await NotifyMVP.unsubscribeFromTopic('cricket');`}</code></pre>
        </div>
      </div>

      <TopicsManager projects={projects} topics={topics as Parameters<typeof TopicsManager>[0]['topics']} />
    </div>
  )
}
