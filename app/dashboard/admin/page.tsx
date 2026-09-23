import { redirect } from 'next/navigation'
import { getSession, isSuperAdmin } from '@/lib/auth/session'
import { getAdminUsers } from '@/lib/actions/admin-users'
import { AdminUsersManager } from '@/components/admin/admin-users-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Super Admin · User Management | NotifyMVP',
  description: 'Manage users, generate credentials, and assign roles.',
}

export default async function AdminUsersPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const isAdmin = await isSuperAdmin(session.email)
  if (!isAdmin) {
    redirect('/dashboard')
  }

  const { users, stats } = await getAdminUsers()

  return (
    <div className="mx-auto max-w-7xl">
      <AdminUsersManager
        initialUsers={users}
        initialStats={stats}
        currentAdminEmail={session.email}
      />
    </div>
  )
}
