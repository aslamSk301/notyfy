import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div
        className="flex flex-1 flex-col"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <Header email={session.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
