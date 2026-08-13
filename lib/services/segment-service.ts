/**
 * User Segment Service (OneSignal Parity)
 * Dynamically builds SQL queries based on segment filter rules for advanced targeting.
 */

import { eq, and, sql, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { segments, segmentRules, devices } from '@/lib/db/schema'
import { generateSecureToken } from '@/lib/utils'
import type { CreateSegmentInput, SegmentRuleInput } from '@/types/onesignal'

/** Create a new dynamic segment with rule set */
export async function createSegment(input: CreateSegmentInput) {
  const db  = await getDb()
  const now = new Date().toISOString()

  const segmentId = generateSecureToken(16)

  await db.insert(segments).values({
    id:          segmentId,
    projectId:   input.projectId,
    name:        input.name,
    description: input.description ?? null,
    createdAt:   now,
    updatedAt:   now,
  })

  if (input.rules && input.rules.length > 0) {
    const ruleValues = input.rules.map((r) => ({
      id:        generateSecureToken(16),
      segmentId: segmentId,
      field:     r.field,
      operator:  r.operator,
      value:     r.value,
    }))
    await db.insert(segmentRules).values(ruleValues)
  }

  return getSegmentById(segmentId)
}

/** Fetch a segment and its rules */
export async function getSegmentById(segmentId: string) {
  const db = await getDb()

  const [segment] = await db.select().from(segments).where(eq(segments.id, segmentId)).limit(1)
  if (!segment) return null

  const rules = await db.select().from(segmentRules).where(eq(segmentRules.segmentId, segmentId))
  return { ...segment, rules }
}

/** Get all segments for a project */
export async function getSegments(projectId: string) {
  const db = await getDb()
  const rows = await db.select().from(segments).where(eq(segments.projectId, projectId))

  const result = await Promise.all(
    rows.map(async (s) => {
      const rules = await db.select().from(segmentRules).where(eq(segmentRules.segmentId, s.id))
      return { ...s, rules }
    })
  )

  return result
}

/** Delete a segment and its associated rules */
export async function deleteSegment(segmentId: string, projectId: string) {
  const db = await getDb()
  await db.delete(segments).where(and(eq(segments.id, segmentId), eq(segments.projectId, projectId)))
  return { success: true }
}

/**
 * Executes a Segment's filter rules against D1 to retrieve matching active device tokens.
 * Yields active FCM tokens in batches (e.g. 500 at a time for multicast).
 */
export async function querySegmentDeviceTokens(
  projectId: string,
  segmentId: string,
  batchSize = 500
): Promise<{ id: string; fcmToken: string }[]> {
  const db = await getDb()

  const rules = await db
    .select()
    .from(segmentRules)
    .where(eq(segmentRules.segmentId, segmentId))

  // Base query: active subscriptions for this project
  const conditions = [
    eq(devices.projectId, projectId),
    eq(devices.status, 'active'),
  ]

  for (const rule of rules) {
    const colName = getColumnForField(rule.field)
    if (!colName) continue

    if (rule.field === 'lastOpen') {
      // Days calculation: last_open >= datetime('now', '-7 days')
      const days = parseInt(rule.value, 10)
      if (!isNaN(days)) {
        if (rule.operator === 'lt') {
          // Last open within last X days: last_open >= datetime('now', '-X days')
          conditions.push(sql`${devices.lastOpen} >= datetime('now', ${`-${days} days`})`)
        } else if (rule.operator === 'gt') {
          // Last open older than X days: last_open < datetime('now', '-X days')
          conditions.push(sql`${devices.lastOpen} < datetime('now', ${`-${days} days`})`)
        }
      }
      continue
    }

    switch (rule.operator) {
      case 'eq':
        conditions.push(sql`${colName} = ${rule.value}`)
        break
      case 'neq':
        conditions.push(sql`${colName} != ${rule.value}`)
        break
      case 'gt':
        conditions.push(sql`${colName} > ${rule.value}`)
        break
      case 'gte':
        conditions.push(sql`${colName} >= ${rule.value}`)
        break
      case 'lt':
        conditions.push(sql`${colName} < ${rule.value}`)
        break
      case 'lte':
        conditions.push(sql`${colName} <= ${rule.value}`)
        break
      case 'contains':
        conditions.push(sql`${colName} LIKE ${`%${rule.value}%`}`)
        break
      case 'in':
        const vals = rule.value.split(',').map((v) => v.trim())
        conditions.push(inArray(colName, vals))
        break
    }
  }

  const matchingDevices = await db
    .select({ id: devices.id, fcmToken: devices.fcmToken })
    .from(devices)
    .where(and(...conditions))
    .limit(batchSize)

  return matchingDevices
}

function getColumnForField(field: string) {
  switch (field) {
    case 'country':                return devices.country
    case 'language':               return devices.language
    case 'platform':               return devices.platform
    case 'osVersion':              return devices.osVersion
    case 'appVersion':             return devices.appVersion
    case 'notificationPermission': return devices.notificationPermission
    case 'status':                 return devices.status
    case 'userId':                 return devices.userId
    default:                       return null
  }
}
