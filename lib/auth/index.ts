/**
 * Better Auth server config — Cloudflare Workers + D1 (via Drizzle adapter)
 *
 * Used ONLY on the server side (route handlers, server actions).
 * For client-side, import from @/lib/auth/client.ts
 *
 * Better Auth uses its own tables prefixed with "ba_" to avoid
 * conflicts with the existing custom "users" table.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { dash } from '@better-auth/infra'
import { getDb } from '@/lib/db/client'
import { baUser, baSession, baAccount, baVerification } from '@/lib/db/schema'

// ── Auth instance (lazy singleton) ───────────────────────────────────────────

// ── Auth instance (lazy singleton) ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null

export async function getAuth() {
  if (_auth) return _auth

  const db = await getDb()

  let cfEnv: any = {}
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    cfEnv = env || {}
  } catch {}

  const secret      = process.env.BETTER_AUTH_SECRET || cfEnv.BETTER_AUTH_SECRET
  const baseURL     = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? cfEnv.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const clientId    = process.env.GOOGLE_CLIENT_ID || cfEnv.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || cfEnv.GOOGLE_CLIENT_SECRET
  const dashApiKey  = process.env.BETTER_AUTH_API_KEY || cfEnv.BETTER_AUTH_API_KEY

  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set')
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set')

  _auth = betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user:         baUser,
        session:      baSession,
        account:      baAccount,
        verification: baVerification,
      },
    }),
    socialProviders: {
      google: {
        clientId,
        clientSecret,
      },
    },
    plugins: [dash({ apiKey: dashApiKey })],
    emailAndPassword: {
      enabled: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
  })

  return _auth
}
