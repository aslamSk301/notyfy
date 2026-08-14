-- Better Auth required tables (SQLite / Cloudflare D1)
-- Run: wrangler d1 execute notifymvp-db --file=drizzle/0008_better_auth_tables.sql
-- Local: wrangler d1 execute notifymvp-db --local --file=drizzle/0008_better_auth_tables.sql

CREATE TABLE IF NOT EXISTS "ba_user" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL UNIQUE,
  "emailVerified"  INTEGER NOT NULL DEFAULT 0,
  "image"          TEXT,
  "createdAt"      TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt"      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "ba_session" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "expiresAt"   TEXT NOT NULL,
  "token"       TEXT NOT NULL UNIQUE,
  "createdAt"   TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt"   TEXT NOT NULL DEFAULT (datetime('now')),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "userId"      TEXT NOT NULL REFERENCES "ba_user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ba_account" (
  "id"                   TEXT NOT NULL PRIMARY KEY,
  "accountId"            TEXT NOT NULL,
  "providerId"           TEXT NOT NULL,
  "userId"               TEXT NOT NULL REFERENCES "ba_user"("id") ON DELETE CASCADE,
  "accessToken"          TEXT,
  "refreshToken"         TEXT,
  "idToken"              TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope"                TEXT,
  "password"             TEXT,
  "createdAt"            TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt"            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "ba_verification" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  TEXT NOT NULL,
  "createdAt"  TEXT DEFAULT (datetime('now')),
  "updatedAt"  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "ba_session_userId_idx" ON "ba_session"("userId");
CREATE INDEX IF NOT EXISTS "ba_account_userId_idx" ON "ba_account"("userId");
CREATE INDEX IF NOT EXISTS "ba_account_providerId_idx" ON "ba_account"("providerId", "accountId");
