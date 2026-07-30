import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Proxy runs on every matching request (Next.js 16+, replaces middleware.ts).
 * It refreshes the Supabase auth session and enforces route protection.
 *
 * API routes (/api/*) are excluded from session handling so their
 * request body is never consumed before the route handler reads it.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip session handling for API routes — they handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
