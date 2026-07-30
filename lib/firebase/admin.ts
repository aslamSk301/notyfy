/**
 * Firebase Admin SDK utilities — modular API (firebase-admin v11+).
 *
 * Each NotifyMVP project has its own Firebase service account credentials.
 * We initialize a separate Firebase App instance per project, keyed by the
 * project UUID, so credentials never bleed between projects.
 *
 * SERVER-ONLY — never import from client components.
 */

import { initializeApp, getApp, deleteApp, cert, type App } from 'firebase-admin/app'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'
import type { ServiceAccount } from 'firebase-admin/app'

// In-process cache of Firebase App instances keyed by NotifyMVP project UUID
const appCache = new Map<string, App>()

export interface FirebaseCredentials {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  [key: string]: unknown
}

/**
 * Get or create a Firebase Admin App instance for a given project.
 *
 * @param projectId  NotifyMVP project UUID — used as the unique Firebase app name
 * @param credentials  Parsed Firebase service account JSON object
 */
export function getFirebaseApp(projectId: string, credentials: FirebaseCredentials): App {
  // Return cached instance if already initialized
  if (appCache.has(projectId)) {
    return appCache.get(projectId)!
  }

  const appName = `notifymvp-${projectId}`

  // Check if Firebase already has this app registered (e.g. after hot-reload in dev)
  let app: App
  try {
    app = getApp(appName)
  } catch {
    // App not found — initialize it now
    app = initializeApp(
      {
        credential: cert(credentials as ServiceAccount),
      },
      appName
    )
  }

  appCache.set(projectId, app)
  return app
}

/**
 * Send a multicast FCM push notification to a list of device tokens.
 * Automatically chunks into batches of 500 (FCM v1 API limit).
 * Returns dead tokens so the caller can remove them from the DB.
 *
 * @returns successCount, failureCount, and deadTokens (uninstalled devices)
 */
export async function sendMulticastNotification(
  app: App,
  tokens: string[],
  title: string,
  body: string
): Promise<{ successCount: number; failureCount: number; deadTokens: string[] }> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, deadTokens: [] }
  }

  const messaging = getMessaging(app)

  // These FCM error codes mean the token is permanently invalid
  // (app uninstalled, app data cleared, token expired)
  const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
  ])

  const CHUNK_SIZE = 500
  let totalSuccess = 0
  let totalFailure = 0
  const deadTokens: string[] = []

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE)

    const message: MulticastMessage = {
      tokens: chunk,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
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
    }

    try {
      const response = await messaging.sendEachForMulticast(message)
      totalSuccess += response.successCount
      totalFailure += response.failureCount

      // Check each failed token — collect dead ones for DB cleanup
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code ?? ''
          console.error(`[FCM] Token failed: code=${code}`)

          if (DEAD_TOKEN_CODES.has(code)) {
            // Token is permanently dead — app uninstalled or token invalid
            deadTokens.push(chunk[idx])
          }
        }
      })
    } catch (err) {
      console.error('[FCM] Multicast chunk error:', err)
      totalFailure += chunk.length
    }
  }

  return { successCount: totalSuccess, failureCount: totalFailure, deadTokens }
}

/**
 * Delete and clean up a Firebase App instance (e.g. after project deletion).
 */
export async function cleanupFirebaseApp(projectId: string): Promise<void> {
  const app = appCache.get(projectId)
  if (app) {
    await deleteApp(app)
    appCache.delete(projectId)
  }
}
