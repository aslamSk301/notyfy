/**
 * Drizzle D1 client factory.
 *
 * Two modes:
 * - Cloudflare Workers (production / wrangler dev):
 *     Uses getCloudflareContext() to get the D1 binding from env.DB
 * - Local Next.js dev (npm run dev):
 *     Uses @miniflare/d1 / wrangler's local SQLite file via REST API
 *     Falls back to a local SQLite file via better-sqlite3 if available
 */

import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/**
 * Returns a Drizzle ORM instance bound to D1.
 * Works in both Cloudflare Workers runtime and local Next.js dev.
 */
export async function getDb(): Promise<Db> {
  // ── Cloudflare Workers runtime (production + wrangler dev) ───────────────
  // getCloudflareContext() only works inside the Cloudflare Workers runtime
  if (process.env.NEXT_RUNTIME === 'edge' || isCloudflareRuntime()) {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    const cfEnv = env as unknown as CloudflareEnv
    return drizzle(cfEnv.DB, { schema })
  }

  // ── Local Next.js dev — use Cloudflare D1 HTTP API ───────────────────────
  // Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN
  // Set these in .env for local development
  const accountId  = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const apiToken   = process.env.CLOUDFLARE_API_TOKEN

  if (accountId && databaseId && apiToken) {
    // Use Cloudflare D1 HTTP API directly via a fetch-based D1 shim
    const d1HttpBinding = createD1HttpBinding(accountId, databaseId, apiToken)
    return drizzle(d1HttpBinding, { schema })
  }

  // ── Fallback: local wrangler SQLite file ─────────────────────────────────
  // Run: npx wrangler d1 execute notifymvp-db --local --file=drizzle/0000_initial.sql
  // Then use wrangler's local proxy: npx wrangler dev --local
  throw new Error(
    'D1 database not configured for local development.\n' +
    'Options:\n' +
    '  1. Add CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID + CLOUDFLARE_API_TOKEN to .env\n' +
    '  2. Use: npm run dev:cf  (wrangler dev --local)\n' +
    'See .env.local.example for setup instructions.'
  )
}

/** Detect if we are running inside the Cloudflare Workers runtime */
function isCloudflareRuntime(): boolean {
  try {
    return typeof (globalThis as Record<string, unknown>).caches !== 'undefined' &&
           typeof (globalThis as Record<string, unknown>).CloudflareError !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Creates a D1-compatible binding that uses the Cloudflare REST API.
 * This lets local `next dev` talk to a remote D1 database.
 */
function createD1HttpBinding(
  accountId: string,
  databaseId: string,
  token: string
): D1Database {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  async function query(sql: string, params: unknown[] = []) {
    const res = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql, params }),
    })
    const json = (await res.json()) as {
      success: boolean
      result: Array<{ results: unknown[]; success: boolean; meta: unknown }>
      errors: Array<{ message: string }>
    }
    if (!json.success) {
      throw new Error(json.errors?.[0]?.message ?? 'D1 HTTP query failed')
    }
    return json.result[0]
  }

  // Minimal D1Database-compatible shim
  return {
    prepare(sql: string) {
      let boundParams: unknown[] = []
      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params
          return stmt
        },
        async first<T = unknown>(col?: string): Promise<T | null> {
          const result = await query(sql, boundParams)
          const row = (result.results as Record<string, unknown>[])[0] ?? null
          if (!row) return null
          return (col ? row[col] : row) as T
        },
        async all<T = unknown>() {
          const result = await query(sql, boundParams)
          return {
            results: result.results as T[],
            success: result.success,
            meta: result.meta,
          }
        },
        async run() {
          const result = await query(sql, boundParams)
          return { success: result.success, meta: result.meta }
        },
        async raw<T = unknown[]>() {
          const result = await query(sql, boundParams)
          return result.results as T[]
        },
      }
      return stmt as unknown as D1PreparedStatement
    },
    async batch(statements: D1PreparedStatement[]) {
      const stmts = statements as unknown as Array<{
        _sql: string; _params: unknown[]
      }>
      const res = await fetch(`${baseUrl}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify(stmts.map((s) => ({ sql: s._sql, params: s._params }))),
      })
      const json = (await res.json()) as {
        success: boolean
        result: Array<{ results: unknown[]; success: boolean; meta: unknown }>
      }
      return json.result as D1Result[]
    },
    async exec(query_str: string) {
      await query(query_str)
      return { count: 0, duration: 0 }
    },
    dump() { throw new Error('dump() not supported in HTTP mode') },
  } as unknown as D1Database
}

export interface CloudflareEnv {
  DB:         D1Database
  R2:         R2Bucket
  ASSETS:     Fetcher
  JWT_SECRET: string
  NEXT_PUBLIC_APP_URL: string
}
