-- Migration 0002 — add description and is_active to topics
-- Run: wrangler d1 execute notifymvp-db --remote --file=drizzle/0002_topics_description.sql

ALTER TABLE `topics` ADD COLUMN `description` TEXT;
ALTER TABLE `topics` ADD COLUMN `is_active`   INTEGER NOT NULL DEFAULT 1;
