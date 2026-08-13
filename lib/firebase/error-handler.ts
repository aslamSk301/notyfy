/**
 * Firebase FCM Error Classifier
 * Distinguishes between permanent token invalidation vs transient retryable errors.
 */

export interface FcmErrorClassification {
  isPermanent: boolean
  shouldMarkInactive: boolean
  shouldRetry: boolean
  description: string
}

export function classifyFcmError(codeOrMessage?: string): FcmErrorClassification {
  if (!codeOrMessage) {
    return {
      isPermanent: false,
      shouldMarkInactive: false,
      shouldRetry: true,
      description: 'Unknown error',
    }
  }

  const errStr = codeOrMessage.toLowerCase()

  // ── Permanent Token Invalidations ──────────────────────────────────────
  if (
    errStr.includes('registration-token-not-registered') ||
    errStr.includes('unregistered') ||
    errStr.includes('not_found') ||
    errStr.includes('mismatched-credential') ||
    errStr.includes('invalid_argument') ||
    errStr.includes('invalid-argument') ||
    errStr.includes('invalid_registration')
  ) {
    return {
      isPermanent: true,
      shouldMarkInactive: true,
      shouldRetry: false,
      description: 'FCM token is permanently invalid or unregistered',
    }
  }

  // ── Permanent Authentication / Configuration Errors ───────────────────
  if (
    errStr.includes('third-party-auth-error') ||
    errStr.includes('sender_id_mismatch') ||
    errStr.includes('authentication_error')
  ) {
    return {
      isPermanent: true,
      shouldMarkInactive: false,
      shouldRetry: false,
      description: 'Permanent project authentication failure',
    }
  }

  // ── Transient / Temporary Network / Server Errors (Retryable) ───────────
  if (
    errStr.includes('quota-exceeded') ||
    errStr.includes('unavailable') ||
    errStr.includes('internal-error') ||
    errStr.includes('timeout') ||
    errStr.includes('503') ||
    errStr.includes('500')
  ) {
    return {
      isPermanent: false,
      shouldMarkInactive: false,
      shouldRetry: true,
      description: 'Transient FCM server error or rate limit',
    }
  }

  // Default fallback: retry transient error
  return {
    isPermanent: false,
    shouldMarkInactive: false,
    shouldRetry: true,
    description: codeOrMessage,
  }
}
