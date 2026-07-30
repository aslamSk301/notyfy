import { getProjects } from '@/lib/actions/projects'
import { getAllNotifications } from '@/lib/actions/notifications'
import { SendNotificationForm } from '@/components/notifications/send-notification-form'
import { NotificationTable } from '@/components/notifications/notification-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const [{ projects }, { notifications }] = await Promise.all([
    getProjects(),
    getAllNotifications(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Send push notifications and view delivery history
        </p>
      </div>

      {/* Send form */}
      <SendNotificationForm projects={projects} />

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--primary)]" />
            Notification history
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-0">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="No notifications sent yet"
              description="Send your first push notification using the form above."
              className="rounded-none border-0 border-t"
            />
          ) : (
            <NotificationTable
              notifications={notifications as Parameters<typeof NotificationTable>[0]['notifications']}
              showProject
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
