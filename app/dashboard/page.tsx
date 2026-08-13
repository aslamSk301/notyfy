import { eq, inArray, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects, devices, notifications } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, Bell, Smartphone, Activity } from 'lucide-react'
import Link from 'next/link'

async function getDashboardStats(userId: string) {
  try {
    const db = await getDb()

    // Step 1 — user's projects
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId))

    const projectIds = userProjects.map((p) => p.id)

    if (projectIds.length === 0) {
      return { projectCount: 0, notificationCount: 0, deviceCount: 0, sentCount: 0 }
    }

    // Step 2 — counts via project IDs
    const [allNotifications, allDevices] = await Promise.all([
      db.select({ status: notifications.status })
        .from(notifications)
        .where(inArray(notifications.projectId, projectIds)),
      db.select({ id: devices.id })
        .from(devices)
        .where(inArray(devices.projectId, projectIds)),
    ])

    return {
      projectCount:      userProjects.length,
      notificationCount: allNotifications.length,
      sentCount:         allNotifications.filter((n) => n.status === 'sent' || n.status === 'completed').length,
      deviceCount:       allDevices.length,
    }
  } catch (err) {
    console.error('[Dashboard] Failed to load stats:', err)
    return { projectCount: 0, notificationCount: 0, deviceCount: 0, sentCount: 0 }
  }
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const stats = await getDashboardStats(session.userId)

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
          {[
            {
              step: 1,
              title: 'Create a project',
              desc: (
                <>
                  Go to{' '}
                  <Link href="/dashboard/projects" className="text-[var(--primary)] hover:underline">
                    Projects
                  </Link>{' '}
                  and upload your Firebase service account JSON.
                </>
              ),
            },
            {
              step: 2,
              title: 'Register devices',
              desc: (
                <>
                  Use your App ID + API Key to call{' '}
                  <code className="rounded bg-[var(--background)] px-1 text-xs text-[var(--primary)]">
                    POST /api/device/register
                  </code>{' '}
                  from your mobile app.
                </>
              ),
            },
            {
              step: 3,
              title: 'Send notifications',
              desc: (
                <>
                  Go to{' '}
                  <Link href="/dashboard/notifications" className="text-[var(--primary)] hover:underline">
                    Notifications
                  </Link>{' '}
                  and send your first push to all registered devices.
                </>
              ),
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3 rounded-md bg-[var(--muted)] p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
