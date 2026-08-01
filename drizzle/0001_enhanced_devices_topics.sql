-- ============================================================
-- NotifyMVP — Migration 0001
-- Enhanced device data + Topics table + Notifications target
-- Run: wrangler d1 execute notifymvp-db --remote --file=drizzle/0001_enhanced_devices_topics.sql
-- ============================================================

-- Add new columns to devices table
ALTER TABLE `devices` ADD COLUMN `device_model`         TEXT;
ALTER TABLE `devices` ADD COLUMN `device_os`            TEXT;
ALTER TABLE `devices` ADD COLUMN `language`             TEXT;
ALTER TABLE `devices` ADD COLUMN `timezone`             TEXT;
ALTER TABLE `devices` ADD COLUMN `external_user_id`     TEXT;
ALTER TABLE `devices` ADD COLUMN `sdk_version`          TEXT;
ALTER TABLE `devices` ADD COLUMN `subscription_status`  TEXT NOT NULL DEFAULT 'subscribed';
ALTER TABLE `devices` ADD COLUMN `last_active`          TEXT;

-- Index for external_user_id lookups
CREATE INDEX IF NOT EXISTS `devices_external_user_idx`
  ON `devices` (`project_id`, `external_user_id`);

-- Topics table — tracks custom FCM topics per project
CREATE TABLE IF NOT EXISTS `topics` (
  `id`          TEXT PRIMARY KEY NOT NULL,
  `project_id`  TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `name`        TEXT NOT NULL,
  `created_at`  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(`project_id`, `name`)
);

CREATE INDEX IF NOT EXISTS `topics_project_id_idx` ON `topics` (`project_id`);

-- Add target column to notifications (all, android, ios, topic:{name}, tokens)
ALTER TABLE `notifications` ADD COLUMN `target` TEXT NOT NULL DEFAULT 'all';
