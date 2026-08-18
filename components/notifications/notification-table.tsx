'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Notification } from '@/types'

const PAGE_SIZE = 20

interface NotificationTableProps {
  notifications: (Notification & { projects?: { name: string } | null })[]
  showProject?: boolean
}

function StatusBadge({ status }: { status: Notification['status'] }) {
  if (status === 'sent' || status === 'completed') return <Badge variant="success">Sent</Badge>
  if (status === 'failed') return <Badge variant="error">Failed</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

export function NotificationTable({ notifications, showProject = false }: NotificationTableProps) {
  const [page, setPage] = useState(0)

  if (notifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
        No notifications sent yet.
      </p>
    )
  }

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE)
  const start      = page * PAGE_SIZE
  const slice      = notifications.slice(start, start + PAGE_SIZE)

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div className="overflow-x-auto">
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
            {slice.map((n) => (
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
                  {n.recipientCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--muted-foreground)]">
                  {n.sentAt ? formatDate(n.sentAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing{' '}
            <span className="font-medium text-[var(--foreground)]">
              {start + 1}–{Math.min(start + PAGE_SIZE, notifications.length)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-[var(--foreground)]">
              {notifications.length}
            </span>{' '}
            notifications
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-[60px] text-center text-xs text-[var(--muted-foreground)]">
              {page + 1} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
