import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, Bell, Smartphone, Activity } from 'lucide-react'
import Link from 'next/link'

async function getDashboardStats(userId: string) {
  const supabase = await createClient()

  const [projectsRes, notificationsRes, devicesRes] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase
      .from('notifications')
      .select('id, project_id, status, projects!inner(user_id)', { count: 'exact' })
      .eq('projects.user_id', userId),
    supabase
      .from('devices')
      .select('id, project_id, projects!inner(user_id)', { count: 'exact' })
      .eq('projects.user_id', userId),
  ])

  const sentCount =
    notificationsRes.data?.filter((n) => n.status === 'sent').length ?? 0

  return {
    projectCount: projectsRes.count ?? 0,
    notificationCount: notificationsRes.count ?? 0,
    deviceCount: devicesRes.count ?? 0,
    sentCount,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stats = await getDashboardStats(user!.id)

  const cards = [
    {
      title: 'Projects',
      value: stats.projectCount,
      icon: FolderOpen,
      description: 'Active projects',
      href: '/dashboard/projects',
      color: 'text-indigo-400',
    },
    {
      title: 'Notifications Sent',
      value: stats.sentCount,
      icon: Bell,
      description: 'Successfully delivered',
      href: '/dashboard/notifications',
      color: 'text-emerald-400',
    },
    {
      title: 'Registered Devices',
      value: stats.deviceCount,
      icon: Smartphone,
      description: 'Across all projects',
      href: '/dashboard/projects',
      color: 'text-amber-400',
    },
    {
      title: 'Total Notifications',
      value: stats.notificationCount,
      icon: Activity,
      description: 'All time',
      href: '/dashboard/notifications',
      color: 'text-blue-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Overview of your push notification platform
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, description, href, color }) => (
          <Link key={title} href={href}>
            <Card className="transition-colors hover:border-[var(--primary)]/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  {title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-md bg-[var(--muted)] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Create a project</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Go to{' '}
                <Link href="/dashboard/projects" className="text-[var(--primary)] hover:underline">
                  Projects
                </Link>{' '}
                and create your first project. Upload your Firebase service account JSON.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md bg-[var(--muted)] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Register devices</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Use your App ID and API Key to call{' '}
                <code className="rounded bg-[var(--background)] px-1 text-xs text-[var(--primary)]">
                  POST /api/device/register
                </code>{' '}
                from your mobile app.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md bg-[var(--muted)] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Send notifications</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Go to{' '}
                <Link
                  href="/dashboard/notifications"
                  className="text-[var(--primary)] hover:underline"
                >
                  Notifications
                </Link>{' '}
                and send your first push to all registered devices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
