/**
 * Canonical FCM topic names (OneSignal-style attribute fan-out).
 * Every name is scoped with appId so two NotifyMVP projects can share one Firebase.
 *
 *   all_{appId}
 *   os_android_{appId} / os_ios_{appId}
 *   country_in_{appId}
 *   language_en_{appId}
 *   version_2_{appId}          ← major ("all v2 devices")
 *   version_2_1_0_{appId}      ← full (optional exact)
 */

export function sanitizeAppId(appId: string): string {
  return appId.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function validateTopicName(name: string): boolean {
  return /^[a-zA-Z0-9-_.~%]{1,900}$/.test(name)
}

export function normalizeCountryCode(countryCode?: string | null): string | null {
  if (!countryCode) return null
  const clean = countryCode.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (clean.length < 2) return null
  return clean.slice(0, 2)
}

export function normalizeLanguageCode(langCode?: string | null): string | null {
  if (!langCode) return null
  const clean = langCode.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (clean.length < 2) return null
  return clean.slice(0, 2)
}

/** Map SDK platform / deviceOs string → android | ios */
export function resolveOs(
  platform?: string | null,
  deviceOs?: string | null
): 'android' | 'ios' | null {
  const p = (platform ?? '').trim().toLowerCase()
  if (p === 'android' || p === 'ios') return p
  const os = (deviceOs ?? '').toLowerCase()
  if (os.includes('android')) return 'android'
  if (os.includes('ios') || os.includes('iphone') || os.includes('ipad')) return 'ios'
  return null
}

export function parseVersionParts(appVersion?: string | null): {
  major: string | null
  full: string | null
} {
  if (!appVersion) return { major: null, full: null }
  const nums = appVersion.trim().match(/\d+/g)
  if (!nums?.length) return { major: null, full: null }
  const major = nums[0]
  const full = nums.join('_')
  return { major, full }
}

export function normalizeCountryTopic(countryCode?: string): string | null {
  const code = normalizeCountryCode(countryCode)
  return code ? `country_${code}` : null
}

export function normalizeLanguageTopic(langCode?: string): string | null {
  const code = normalizeLanguageCode(langCode)
  return code ? `language_${code}` : null
}

export function normalizeOsTopic(platform?: string): string | null {
  const os = resolveOs(platform)
  return os ? `os_${os}` : null
}

export function normalizeVersionTopic(appVersion?: string): string | null {
  const { full } = parseVersionParts(appVersion)
  return full ? `version_${full}` : null
}

export interface DeviceTopicAttrs {
  platform?: string | null
  deviceOs?: string | null
  country?: string | null
  language?: string | null
  appVersion?: string | null
}

/** All system FCM topics this device should be on right now. */
export function buildSystemTopicNames(appId: string, attrs: DeviceTopicAttrs): string[] {
  const id = sanitizeAppId(appId)
  const names: string[] = [`all_${id}`]

  const os = resolveOs(attrs.platform, attrs.deviceOs)
  if (os) names.push(`os_${os}_${id}`)

  const country = normalizeCountryCode(attrs.country)
  if (country) names.push(`country_${country}_${id}`)

  const language = normalizeLanguageCode(attrs.language)
  if (language) names.push(`language_${language}_${id}`)

  const { major, full } = parseVersionParts(attrs.appVersion)
  if (major) names.push(`version_${major}_${id}`)
  if (full && full !== major) names.push(`version_${full}_${id}`)

  return [...new Set(names.filter(validateTopicName))]
}

export function topicDescription(topicName: string, appId: string): string {
  const suffix = `_${sanitizeAppId(appId)}`
  const base = topicName.endsWith(suffix) ? topicName.slice(0, -suffix.length) : topicName

  if (base === 'all') return 'All users'
  if (base === 'os_android') return 'OS: Android'
  if (base === 'os_ios') return 'OS: iOS'
  if (base.startsWith('country_')) return `Country: ${base.slice(8).toUpperCase()}`
  if (base.startsWith('language_')) return `Language: ${base.slice(9)}`
  if (base.startsWith('version_')) return `App version ${base.slice(8).replace(/_/g, '.')}`
  if (base.startsWith('permission_')) return `System topic: permission`
  return topicName
}

/** Production `topics.kind/category/value` columns for a system topic name. */
export function systemTopicColumns(
  topicName: string,
  appId: string
): { category: string; value: string | null; description: string } {
  const suffix = `_${sanitizeAppId(appId)}`
  const base = topicName.endsWith(suffix) ? topicName.slice(0, -suffix.length) : topicName
  const description = topicDescription(topicName, appId)

  if (base === 'all') return { category: 'all', value: null, description }
  if (base.startsWith('os_')) return { category: 'os', value: base.slice(3), description }
  if (base.startsWith('country_')) return { category: 'country', value: base.slice(8), description }
  if (base.startsWith('language_')) return { category: 'language', value: base.slice(9), description }
  if (base.startsWith('version_')) {
    return { category: 'version', value: base.slice(8).replace(/_/g, '.'), description }
  }
  if (base.startsWith('permission_')) {
    return { category: 'permission', value: base.slice(11), description }
  }
  return { category: 'custom', value: null, description }
}

export type AudienceResolution =
  | { kind: 'topic'; topic: string }
  | { kind: 'segment'; segmentId: string }
  | { kind: 'tokens' }
  | { kind: 'user'; userId: string }

/**
 * Map dashboard / API target strings onto a single FCM topic (or segment/user).
 */
export function resolveAudienceTarget(appId: string, target: string): AudienceResolution {
  const t = (target || 'all').trim()
  const id = sanitizeAppId(appId)

  if (t === 'tokens') return { kind: 'tokens' }
  if (t === 'user') return { kind: 'user', userId: '' }
  if (t.startsWith('user:')) return { kind: 'user', userId: t.slice(5) }
  if (t.startsWith('segment:')) return { kind: 'segment', segmentId: t.slice(8) }

  if (t === 'all' || t === 'all_users') return { kind: 'topic', topic: `all_${id}` }
  if (t === 'android' || t === 'ios') return { kind: 'topic', topic: `os_${t}_${id}` }
  if (t === 'flutter' || t === 'react-native') return { kind: 'topic', topic: `${t}_${id}` }

  if (t.startsWith('version:')) {
    const v = t.slice(8).trim().replace(/[^a-zA-Z0-9]/g, '_')
    return { kind: 'topic', topic: `version_${v}_${id}` }
  }
  if (t.startsWith('country:')) {
    const c = normalizeCountryCode(t.slice(8))
    if (c) return { kind: 'topic', topic: `country_${c}_${id}` }
  }
  if (t.startsWith('os:')) {
    const os = t.slice(3).trim().toLowerCase()
    if (os === 'android' || os === 'ios') return { kind: 'topic', topic: `os_${os}_${id}` }
  }
  if (t.startsWith('topic:')) return { kind: 'topic', topic: t.slice(6).trim() }

  return { kind: 'topic', topic: t }
}

/** Cloudflare edge country (XX/T1 = unknown / tor). */
export function countryFromRequest(
  headers: Headers,
  bodyCountry?: string | null
): string | undefined {
  const header =
    headers.get('cf-ipcountry') ||
    headers.get('CF-IPCountry') ||
    headers.get('x-vercel-ip-country')
  if (header && header.length === 2 && header !== 'XX' && header !== 'T1') {
    return header.toUpperCase()
  }
  const fromBody = normalizeCountryCode(bodyCountry)
  return fromBody ? fromBody.toUpperCase() : undefined
}
