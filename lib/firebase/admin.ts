/**
 * FCM HTTP v1 REST API — replaces firebase-admin SDK.
 *
 * Uses only `fetch()` and `jose` (already installed for JWT auth).
 * Works in Cloudflare Workers, Vercel, and local Next.js dev.
 * Zero additional dependencies.
 *
 * SERVER-ONLY — never import from client components.
 */

import { SignJWT, importPKCS8 } from 'jose'

export interface FirebaseCredentials {
  type:          string
  project_id:    string
  private_key_id:string
  private_key:   string
  client_email:  string
  client_id:     string
  token_uri:     string
  [key: string]: unknown
}

export interface FcmSendResult {
  successCount: number
  failureCount: number
  deadTokens:   string[]
}

// ── OAuth2 token cache ────────────────────────────────────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessToken(credentials: FirebaseCredentials): Promise<string> {
  const cacheKey = credentials.client_email
  const cached   = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const privateKey = await importPKCS8(credentials.private_key, 'RS256')
  const now        = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer(credentials.client_email)
    .setAudience(credentials.token_uri)
    .sign(privateKey)

  const tokenRes = await fetch(credentials.token_uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google OAuth2 token exchange failed: ${tokenRes.status} — ${err}`)
  }

  const data = (await tokenRes.json()) as { access_token: string; expires_in: number }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
  return data.access_token
}

// ── Dead token error codes ────────────────────────────────────────────────────
const DEAD_TOKEN_STATUSES = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'NOT_FOUND',
])

// ── Send to single token ──────────────────────────────────────────────────────
async function sendOne(
  accessToken: string,
  projectId:   string,
  fcmToken:    string,
  title:       string,
  body:        string,
  data?:       Record<string, string>
): Promise<{ success: boolean; isDeadToken: boolean }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        ...(data && { data }),
        android: { priority: 'high', notification: { sound: 'default', click_action: 'FLUTTER_NOTIFICATION_CLICK' } },
        apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
      },
    }),
  })

  if (res.ok) return { success: true, isDeadToken: false }

  const errBody = (await res.json()) as { error?: { status?: string; code?: number } }
  const status  = errBody.error?.status ?? ''
  console.error(`[FCM] Token failed: status=${status} token=…${fcmToken.slice(-8)}`)
  return { success: false, isDeadToken: DEAD_TOKEN_STATUSES.has(status) }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a push notification to multiple FCM tokens (multicast via batched fetch).
 */
export async function sendMulticastNotification(
  credentials: FirebaseCredentials,
  tokens:      string[],
  title:       string,
  body:        string,
  data?:       Record<string, string>
): Promise<FcmSendResult> {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, deadTokens: [] }

  const accessToken = await getAccessToken(credentials)
  const projectId   = credentials.project_id

  let successCount = 0
  let failureCount = 0
  const deadTokens: string[] = []

  const BATCH_SIZE = 50
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch   = tokens.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((token) => sendOne(accessToken, projectId, token, title, body, data))
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled') {
        if (r.value.success)      successCount++
        else {
          failureCount++
          if (r.value.isDeadToken) deadTokens.push(batch[j])
        }
      } else {
        console.error('[FCM] Unexpected error:', r.reason)
        failureCount++
      }
    }
  }

  return { successCount, failureCount, deadTokens }
}

/**
 * Send a notification to an FCM topic.
 * One API call reaches all devices subscribed to the topic — no token loop needed.
 *
 * @param topicName  e.g. "all_app_abc123", "android_app_abc123", "sports"
 */
export async function sendToTopic(
  credentials: FirebaseCredentials,
  topicName:   string,
  title:       string,
  body:        string,
  data?:       Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken(credentials)
  const url = `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`

  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: topicName,
        notification: { title, body },
        ...(data && { data }),
        android: { priority: 'high', notification: { sound: 'default' } },
        apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
      },
    }),
  })

  if (res.ok) return { success: true }
  const err = (await res.json()) as { error?: { message?: string } }
  return { success: false, error: err.error?.message ?? `HTTP ${res.status}` }
}

/**
 * Subscribe one or more FCM tokens to a topic using the IID (Instance ID) API.
 * This is the server-side way to manage topic subscriptions.
 *
 * Note: FCM v1 does not have a native topic management API on the send endpoint.
 * The IID HTTP API is still active and handles this.
 */
export async function subscribeTokensToTopic(
  credentials: FirebaseCredentials,
  tokens:      string[],
  topicName:   string
): Promise<{ successCount: number; failureCount: number }> {
  return manageTopic('batchAdd', credentials, tokens, topicName)
}

/**
 * Unsubscribe one or more FCM tokens from a topic.
 */
export async function unsubscribeTokensFromTopic(
  credentials: FirebaseCredentials,
  tokens:      string[],
  topicName:   string
): Promise<{ successCount: number; failureCount: number }> {
  return manageTopic('batchRemove', credentials, tokens, topicName)
}

async function manageTopic(
  operation:   'batchAdd' | 'batchRemove',
  credentials: FirebaseCredentials,
  tokens:      string[],
  topicName:   string
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 }

  const accessToken = await getAccessToken(credentials)

  // IID API supports up to 1000 tokens per request
  const CHUNK = 1000
  let successCount = 0
  let failureCount = 0

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK)
    const res   = await fetch(
      `https://iid.googleapis.com/iid/v1:${operation}`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          access_token_auth: 'true',
        },
        body: JSON.stringify({
          registration_tokens: chunk,
          to:                  `/topics/${topicName}`,
        }),
      }
    )

    if (res.ok) {
      const data = (await res.json()) as { results?: Array<{ error?: string }> }
      for (const result of data.results ?? []) {
        if (result.error) failureCount++
        else              successCount++
      }
    } else {
      console.error(`[FCM Topics] ${operation} failed: HTTP ${res.status}`)
      failureCount += chunk.length
    }
  }

  return { successCount, failureCount }
}

/**
 * Validate Firebase service account JSON.
 */
export function validateFirebaseCredentials(
  json: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (json.type !== 'service_account') {
    return { valid: false, error: 'Not a service account JSON — "type" must be "service_account"' }
  }
  for (const field of ['project_id', 'private_key', 'client_email', 'token_uri']) {
    if (!json[field]) return { valid: false, error: `Missing required field: "${field}"` }
  }
  return { valid: true }
}
