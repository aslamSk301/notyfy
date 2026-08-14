/**
 * Better Auth catch-all route handler
 * Handles all /api/auth/* requests: sign-in, sign-up, callback, session, etc.
 */

import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/lib/auth'

async function handler(req: Request) {
  const auth = await getAuth()
  const nextHandler = toNextJsHandler(auth)
  if (req.method === 'POST') return nextHandler.POST(req)
  return nextHandler.GET(req)
}

export { handler as GET, handler as POST }
