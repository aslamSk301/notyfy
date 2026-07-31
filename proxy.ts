import { type NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth/jwt'

/**
 * Proxy (Next.js 16+ middleware replacement).
 *
 * Replaces Supabase session handling with JWT cookie verification.
 * - API routes (/api/*) bypass auth — they handle their own authentication
 * - Dashboard routes require a valid JWT session cookie
 * - Auth pages redirect logged-in users to dashboard
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes — skip, handle own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verifySessionToken(token) : null
  const isLoggedIn = !!session

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard') && !isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === '/login' || pathname === '/register') && isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
