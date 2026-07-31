import type { Config } from 'drizzle-kit'

export default {
  schema:  './lib/db/schema.ts',
  out:     './drizzle',
  dialect: 'sqlite',
  driver:  'd1-http',                          // Cloudflare D1
  dbCredentials: {
    accountId:  process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token:      process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config
