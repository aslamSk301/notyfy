import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div
        className="flex flex-1 flex-col"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <Header email={user.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
