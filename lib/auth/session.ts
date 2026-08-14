/**
 * Session helpers — works with both Better Auth sessions and legacy JWT cookies.
 * Server Components, Server Actions, and Route Handlers.
 */

import { cookies } from 'next/headers'
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from './jwt'

const COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'lax' as const,
  path:      '/',
  maxAge:    60 * 60 * 24 * 7, // 7 days
}

/** Get the current session from either Better Auth or legacy JWT cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  // ── 1. Try Better Auth session ────────────────────────────────────────────
  try {
    const { getAuth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = await getAuth() as any
    const cookieStore = await cookies()
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    })

    if (session?.user?.id && session.user.email) {
      return { userId: session.user.id, email: session.user.email }
    }
  } catch {
    // Better Auth not available or no session — fall through to legacy
  }

  // ── 2. Fallback: legacy JWT cookie ────────────────────────────────────────
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifySessionToken(token)
  } catch {
    return null
  }
}

/** Set the legacy session cookie (used by email/password login action) */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

/** Clear all session cookies on logout */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  // Clear legacy JWT cookie
  cookieStore.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  // Clear Better Auth cookie
  cookieStore.set('better-auth.session_token', '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

/** Get session or throw — use in protected Server Actions */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  return session
}
