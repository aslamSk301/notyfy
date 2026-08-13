/**
 * Firebase FCM Client for Cloudflare Workers (Edge Compatible)
 * Uses HTTP v1 API with JWT OAuth2 Service Account access tokens.
 */

import { SignJWT, importPKCS8 } from 'jose'
import { classifyFcmError } from './error-handler'
import type { FcmPayload, FcmResponse } from '@/types/onesignal'

export interface FirebaseServiceAccount {
  type:                        string
  project_id:                  string
  private_key_id:              string
  private_key:                 string
  client_email:                string
  client_id:                   string
  auth_uri:                    string
  token_uri:                   string
  auth_provider_x509_cert_url: string
  client_x509_cert_url:        string
}

/** Obtains an OAuth2 access token for FCM HTTP v1 using Service Account JSON */
export async function getFcmAccessToken(credentials: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const privateKey = await importPKCS8(credentials.private_key, 'RS256')

  const jwt = await new SignJWT({
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Failed to obtain Google access token: ${errText}`)
  }

  const tokenJson = (await tokenRes.json()) as { access_token: string }
  return tokenJson.access_token
}

/** Sends a notification to a specific FCM Topic (e.g., "all_users", "country_in") */
export async function sendFcmTopicNotification(
  credentials: FirebaseServiceAccount,
  payload: FcmPayload
): Promise<FcmResponse> {
  if (!payload.topic) throw new Error('Topic is required for topic notification')

  const accessToken = await getFcmAccessToken(credentials)
  const endpoint = `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`

  const body = {
    message: {
      topic: payload.topic,
      notification: {
        title: payload.title,
        body:  payload.body,
        image: payload.image ?? undefined,
      },
      data: {
        ...(payload.data ?? {}),
        title:       payload.title,
        body:        payload.body,
        image:       payload.image ?? '',
        icon:        payload.icon ?? '',
        badge:       payload.badge ? String(payload.badge) : '',
        sound:       payload.sound ?? '',
        deepLink:    payload.deepLink ?? '',
        clickAction: payload.clickAction ?? '',
      },
      android: {
        priority: payload.priority === 'normal' ? 'NORMAL' : 'HIGH',
        ttl:      `${payload.ttl ?? 86400}s`,
        notification: {
          channel_id: payload.channelId ?? 'default',
          sound:      payload.sound ?? 'default',
          icon:       payload.icon ?? undefined,
        },
      },
      apns: {
        headers: {
          'apns-priority': payload.priority === 'normal' ? '5' : '10',
        },
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: payload.sound ?? 'default',
            badge: payload.badge ?? 1,
          },
        },
      },
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.ok) {
    const json = (await res.json()) as { name: string }
    return { success: true, messageId: json.name }
  }

  const errorText = await res.text()
  const classification = classifyFcmError(errorText)
  return {
    success: false,
    error: errorText,
    errorCode: classification.description,
    isPermanent: classification.isPermanent,
  }
}

/** Sends a notification to a specific FCM Registration Token */
export async function sendFcmTokenNotification(
  credentials: FirebaseServiceAccount,
  payload: FcmPayload
): Promise<FcmResponse> {
  if (!payload.token) throw new Error('Registration Token is required')

  const accessToken = await getFcmAccessToken(credentials)
  const endpoint = `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`

  const body = {
    message: {
      token: payload.token,
      notification: {
        title: payload.title,
        body:  payload.body,
        image: payload.image ?? undefined,
      },
      data: {
        ...(payload.data ?? {}),
        title:       payload.title,
        body:        payload.body,
        image:       payload.image ?? '',
        icon:        payload.icon ?? '',
        badge:       payload.badge ? String(payload.badge) : '',
        sound:       payload.sound ?? '',
        deepLink:    payload.deepLink ?? '',
        clickAction: payload.clickAction ?? '',
      },
      android: {
        priority: payload.priority === 'normal' ? 'NORMAL' : 'HIGH',
        ttl:      `${payload.ttl ?? 86400}s`,
        notification: {
          channel_id: payload.channelId ?? 'default',
          sound:      payload.sound ?? 'default',
          icon:       payload.icon ?? undefined,
        },
      },
      apns: {
        headers: {
          'apns-priority': payload.priority === 'normal' ? '5' : '10',
        },
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: payload.sound ?? 'default',
            badge: payload.badge ?? 1,
          },
        },
      },
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.ok) {
    const json = (await res.json()) as { name: string }
    return { success: true, messageId: json.name }
  }

  const errorText = await res.text()
  const classification = classifyFcmError(errorText)
  return {
    success: false,
    error: errorText,
    errorCode: classification.description,
    isPermanent: classification.isPermanent,
  }
}
