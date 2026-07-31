/**
 * Session helpers — read/write the JWT cookie from Server Components,
 * Server Actions, and Route Handlers.
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

/** Get the current session. Returns null if not logged in. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/** Set the session cookie after login/register */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

/** Clear the session cookie on logout */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

/** Get session or throw — use in protected Server Actions */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  return session
}
