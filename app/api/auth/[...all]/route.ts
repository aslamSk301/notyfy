/**
 * Better Auth catch-all route handler
 * Handles all /api/auth/* requests: sign-in, sign-up, callback, session, etc.
 */

import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/lib/auth'

async function handler(req: Request) {
  try {
    const auth = await getAuth()
    const nextHandler = toNextJsHandler(auth)
    if (req.method === 'POST') return await nextHandler.POST(req)
    return await nextHandler.GET(req)
  } catch (error: any) {
    console.error('[Better Auth Handler Error]:', error?.message || error, error?.stack)
    return new Response(
      JSON.stringify({
        error: error?.message || 'Authentication error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export { handler as GET, handler as POST }
