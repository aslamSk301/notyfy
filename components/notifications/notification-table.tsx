import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Notification } from '@/types'

interface NotificationTableProps {
  notifications: (Notification & { projects?: { name: string } | null })[]
  showProject?: boolean
}

function StatusBadge({ status }: { status: Notification['status'] }) {
  if (status === 'sent') return <Badge variant="success">Sent</Badge>
  if (status === 'failed') return <Badge variant="error">Failed</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

export function NotificationTable({ notifications, showProject = false }: NotificationTableProps) {
  if (notifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
        No notifications sent yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Message
            </th>
            {showProject && (
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Project
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Recipients
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Sent At
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {notifications.map((n) => (
            <tr key={n.id} className="bg-[var(--card)] transition-colors hover:bg-[var(--muted)]/30">
              <td className="max-w-[160px] truncate px-4 py-3 font-medium text-[var(--foreground)]">
                {n.title}
              </td>
              <td className="max-w-[220px] truncate px-4 py-3 text-[var(--muted-foreground)]">
                {n.body}
              </td>
              {showProject && (
                <td className="px-4 py-3 text-[var(--muted-foreground)]">
                  {n.projects?.name ?? '—'}
                </td>
              )}
              <td className="px-4 py-3">
                <StatusBadge status={n.status} />
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--foreground)]">
                {n.recipient_count}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--muted-foreground)]">
                {n.sent_at ? formatDate(n.sent_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
