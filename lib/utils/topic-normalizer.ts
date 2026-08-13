/**
 * Topic normalization and validation helpers.
 * Ensures consistent topic naming across SDKs and backend.
 */

export function normalizeCountryTopic(countryCode?: string): string | null {
  if (!countryCode) return null
  const clean = countryCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!clean || clean.length < 2) return null
  return `country_${clean.slice(0, 2)}`
}

export function normalizeLanguageTopic(langCode?: string): string | null {
  if (!langCode) return null
  const clean = langCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!clean || clean.length < 2) return null
  return `language_${clean.slice(0, 2)}`
}

export function normalizeOsTopic(platform?: string): string | null {
  if (!platform) return null
  const clean = platform.trim().toLowerCase()
  if (clean === 'android') return 'os_android'
  if (clean === 'ios') return 'os_ios'
  return null
}

export function normalizeVersionTopic(appVersion?: string): string | null {
  if (!appVersion) return null
  const clean = appVersion.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  if (!clean) return null
  return `version_${clean}`
}

export function validateTopicName(name: string): boolean {
  // FCM topic names must match [a-zA-Z0-9-_.~%]+
  return /^[a-zA-Z0-9-_.~%]{1,900}$/.test(name)
}
