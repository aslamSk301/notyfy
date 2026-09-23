-- Migration 0009: Add role and status to ba_user for Super Admin management
-- SQLite / Cloudflare D1 supports ALTER TABLE ADD COLUMN

ALTER TABLE "ba_user" ADD COLUMN "role" TEXT DEFAULT 'user';
ALTER TABLE "ba_user" ADD COLUMN "status" TEXT DEFAULT 'active';

-- Set contact.earnslash@gmail.com as superadmin by default
UPDATE "ba_user" SET "role" = 'superadmin' WHERE "email" = 'contact.earnslash@gmail.com';
