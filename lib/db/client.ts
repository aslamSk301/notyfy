/**
 * Drizzle D1 client factory.
 *
 * In Cloudflare Workers the D1 database is injected via the `env` binding.
 * We access it through `getCloudflareContext()` from @opennextjs/cloudflare.
 *
 * Usage (Server Component / Server Action / Route Handler):
 *   const db = await getDb()
 *   const rows = await db.select().from(projects).where(...)
 */

import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/**
 * Returns a Drizzle ORM instance bound to the D1 database.
 * Must be called inside a request context (Server Action / Route Handler).
 */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true })
  const cfEnv = env as unknown as CloudflareEnv
  return drizzle(cfEnv.DB, { schema })
}

/**
 * Cloudflare environment type — augments the Worker env with our bindings.
 * Keep in sync with wrangler.jsonc bindings.
 */
export interface CloudflareEnv {
  DB:     D1Database
  R2:     R2Bucket
  ASSETS: Fetcher
  JWT_SECRET: string
  NEXT_PUBLIC_APP_URL: string
}
