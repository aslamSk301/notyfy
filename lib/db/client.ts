/**
 * Drizzle D1 client factory.
 *
 * - Cloudflare Workers runtime: uses getCloudflareContext() D1 binding
 * - Local next dev: uses Cloudflare D1 HTTP API via a proper D1 shim
 */

import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

export async function getDb(): Promise<Db> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    const cfEnv = env as unknown as CloudflareEnv
    if (cfEnv && cfEnv.DB) {
      return drizzle(cfEnv.DB, { schema })
    }
  } catch {
    // Fall back to local D1 HTTP API shim below
  }

  // ── Local next dev — D1 HTTP API shim ─────────────────────────────────────
  const accountId  = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const apiToken   = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'Missing Cloudflare credentials in .env:\n' +
      '  CLOUDFLARE_ACCOUNT_ID\n' +
      '  CLOUDFLARE_D1_DATABASE_ID\n' +
      '  CLOUDFLARE_API_TOKEN\n'
    )
  }

  return drizzle(makeD1Shim(accountId, databaseId, apiToken), { schema })
}

/**
 * Creates a D1Database-compatible shim that proxies all queries
 * to the Cloudflare D1 HTTP API.
 *
 * Drizzle calls: prepare(sql).bind(...params).all() / .first() / .run()
 */
function makeD1Shim(
  accountId: string,
  databaseId: string,
  token: string
): D1Database {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  async function execQuery(
    sql: string,
    params: unknown[]
  ): Promise<{ results: Record<string, unknown>[]; meta: unknown }> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql, params }),
    })

    const json = (await res.json()) as {
      success: boolean
      result: Array<{ results: Record<string, unknown>[]; success: boolean; meta: unknown }>
      errors: Array<{ code: number; message: string }>
    }

    if (!json.success || !json.result?.[0]) {
      const msg = json.errors?.[0]?.message ?? 'D1 HTTP API error'
      throw new Error(msg)
    }

    return {
      results: json.result[0].results ?? [],
      meta: json.result[0].meta ?? {},
    }
  }

  function makeStatement(sql: string, boundParams: unknown[] = []): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind(...params: unknown[]) {
        return makeStatement(sql, params)
      },

      async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const { results } = await execQuery(sql, boundParams)
        const row = results[0] ?? null
        if (row === null) return null
        if (col !== undefined) return (row[col] as T) ?? null
        return row as T
      },

      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const { results, meta } = await execQuery(sql, boundParams)
        return {
          results: results as T[],
          success: true,
          meta,
        } as D1Result<T>
      },

      async run(): Promise<D1Result<never>> {
        const { meta } = await execQuery(sql, boundParams)
        return { results: [], success: true, meta } as D1Result<never>
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw: (async (options?: { columnNames?: boolean }) => {
        const { results } = await execQuery(sql, boundParams)
        if (options?.columnNames && results.length > 0) {
          const cols = Object.keys(results[0])
          return [cols, ...results.map((r) => Object.values(r))]
        }
        return results.map((r) => Object.values(r))
      }) as D1PreparedStatement['raw'],
    }
    return stmt
  }

  return {
    prepare(sql: string) {
      return makeStatement(sql)
    },

    async batch<T = unknown>(
      statements: D1PreparedStatement[]
    ): Promise<D1Result<T>[]> {
      // Execute sequentially for the HTTP shim
      const results: D1Result<T>[] = []
      for (const stmt of statements) {
        results.push(await stmt.all<T>())
      }
      return results
    },

    async exec(query: string): Promise<D1ExecResult> {
      await execQuery(query, [])
      return { count: 1, duration: 0 }
    },

    dump(): never {
      throw new Error('dump() not supported in HTTP mode')
    },
  } as unknown as D1Database
}

export interface CloudflareEnv {
  DB:         D1Database
  R2:         R2Bucket
  ASSETS:     Fetcher
  JWT_SECRET: string
  NEXT_PUBLIC_APP_URL: string
}
