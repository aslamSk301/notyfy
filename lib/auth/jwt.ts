/**
 * JWT utilities using `jose` — Edge-compatible (no Node.js crypto).
 * Signs and verifies session tokens stored in HTTP-only cookies.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export interface SessionPayload extends JWTPayload {
  userId: string
  email:  string
}

const COOKIE_NAME  = 'notifymvp_session'
const TOKEN_EXPIRY = '7d'

/** Get the JWT secret from Cloudflare Worker env */
async function getSecret(): Promise<Uint8Array> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const secret = (env as { JWT_SECRET?: string }).JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    return new TextEncoder().encode(secret)
  } catch {
    // Local dev fallback — never use in production
    const fallback = process.env.JWT_SECRET ?? 'local-dev-secret-change-me'
    return new TextEncoder().encode(fallback)
  }
}

/** Create a signed JWT session token */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = await getSecret()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret)
}

/** Verify and decode a JWT session token. Returns null if invalid/expired. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secret = await getSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as SessionPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME }
