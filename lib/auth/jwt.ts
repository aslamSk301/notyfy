/**
 * JWT utilities using `jose` — Edge-compatible (no Node.js crypto).
 * Signs and verifies session tokens stored in HTTP-only cookies.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface SessionPayload extends JWTPayload {
  userId: string
  email:  string
}

const COOKIE_NAME  = 'notifymvp_session'
const TOKEN_EXPIRY = '7d'

/** Get the JWT secret — works in Cloudflare Workers and local dev */
function getSecret(): Uint8Array {
  // On Cloudflare Workers (via OpenNext), secrets are available on process.env
  const secret = process.env.JWT_SECRET ?? 'local-dev-secret-change-me'
  return new TextEncoder().encode(secret)
}

/** Create a signed JWT session token */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecret()
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
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as SessionPayload
  } catch {
    return null
  }
}

export { COOKIE_NAME }
