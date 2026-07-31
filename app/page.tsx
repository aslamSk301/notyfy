import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

/**
 * Root page — redirect to dashboard if logged in, otherwise to login.
 */
export default async function RootPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')
  redirect('/login')
}
