/**
 * FCM HTTP v1 REST API — replaces firebase-admin SDK.
 *
 * Uses only `fetch()` and `jose` (already installed for JWT auth).
 * Works in Cloudflare Workers, Vercel, and local Next.js dev.
 * Zero additional dependencies.
 *
 * Flow:
 *   1. Parse the Firebase service account JSON
 *   2. Sign a short-lived JWT with the service account private key
 *   3. Exchange the JWT for a Google OAuth2 access token
 *   4. Call the FCM v1 API with that access token
 *
 * Each NotifyMVP project has its own service account — credentials
 * are never shared between projects.
 *
 * SERVER-ONLY — never import from client components.
 */

import { SignJWT, importPKCS8 } from 'jose'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FirebaseCredentials {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  token_uri: string
  [key: string]: unknown
}

interface FcmSendResult {
  successCount: number
  failureCount: number
  deadTokens: string[]   // tokens that are permanently invalid (app uninstalled)
}

// ── Google OAuth2 access token cache ─────────────────────────────────────────
// Key: client_email, Value: { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/**
 * Get a short-lived Google OAuth2 access token for the FCM API.
 * Caches the token until 60 seconds before expiry.
 */
async function getAccessToken(credentials: FirebaseCredentials): Promise<string> {
  const cacheKey = credentials.client_email
  const cached = tokenCache.get(cacheKey)

  // Return cached token if still valid (with 60s buffer)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  // Import the RSA private key from the service account JSON
  // Firebase private keys are in PKCS#8 PEM format
  const privateKey = await importPKCS8(credentials.private_key, 'RS256')

  const now = Math.floor(Date.now() / 1000)

  // Build and sign the JWT assertion
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)          // 1-hour JWT
    .setIssuer(credentials.client_email)
    .setAudience(credentials.token_uri)
    .sign(privateKey)

  // Exchange the JWT for an access token via Google's OAuth2 token endpoint
  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    throw new Error(`Google OAuth2 token exchange failed: ${tokenResponse.status} — ${err}`)
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string
    expires_in: number
  }

  // Cache the token
  tokenCache.set(cacheKey, {
    token:     tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  })

  return tokenData.access_token
}

/**
 * Send a push notification to a single FCM token.
 * Returns the FCM message name on success, or throws on error.
 */
async function sendOne(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string
): Promise<{ success: boolean; isDeadToken: boolean }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: {
          sound:       'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    },
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })

  if (res.ok) {
    return { success: true, isDeadToken: false }
  }

  const errBody = (await res.json()) as {
    error?: { code?: number; status?: string; message?: string }
  }
  const status = errBody.error?.status ?? ''

  // These statuses mean the token is permanently invalid
  const deadTokenStatuses = new Set([
    'UNREGISTERED',          // app uninstalled
    'INVALID_ARGUMENT',      // malformed token
    'NOT_FOUND',             // token deleted / revoked
  ])

  const isDeadToken = deadTokenStatuses.has(status)

  console.error(
    `[FCM] Token failed: status=${status} code=${errBody.error?.code} token=…${fcmToken.slice(-8)}`
  )

  return { success: false, isDeadToken }
}

/**
 * Send a multicast push notification to multiple FCM tokens.
 *
 * Automatically batches to avoid rate limits (50 concurrent requests).
 * Returns successCount, failureCount, and deadTokens for DB cleanup.
 *
 * @param credentials  Parsed Firebase service account JSON
 * @param tokens       List of FCM device tokens
 * @param title        Notification title
 * @param body         Notification body
 */
export async function sendMulticastNotification(
  credentials: FirebaseCredentials,
  tokens: string[],
  title: string,
  body: string
): Promise<FcmSendResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, deadTokens: [] }
  }

  const accessToken = await getAccessToken(credentials)
  const projectId   = credentials.project_id

  let successCount = 0
  let failureCount = 0
  const deadTokens: string[] = []

  // Process in batches of 50 concurrent requests
  const BATCH_SIZE = 50

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map((token) => sendOne(accessToken, projectId, token, title, body))
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++
        } else {
          failureCount++
          if (result.value.isDeadToken) {
            deadTokens.push(batch[j])
          }
        }
      } else {
        // Promise rejected (network error etc.)
        console.error('[FCM] Unexpected error for token:', result.reason)
        failureCount++
      }
    }
  }

  return { successCount, failureCount, deadTokens }
}

/**
 * Validate that a parsed JSON object looks like a valid Firebase service account.
 * Call this when the user uploads their JSON to give early feedback.
 */
export function validateFirebaseCredentials(
  json: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (json.type !== 'service_account') {
    return { valid: false, error: 'Not a service account JSON — "type" must be "service_account"' }
  }
  const required = ['project_id', 'private_key', 'client_email', 'token_uri']
  for (const field of required) {
    if (!json[field]) {
      return { valid: false, error: `Missing required field: "${field}"` }
    }
  }
  return { valid: true }
}
