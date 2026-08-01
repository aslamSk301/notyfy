-- Migration 0003 — device_topics junction table
-- Admin assigns devices to topics; device auto-syncs on app open
-- Run: wrangler d1 execute notifymvp-db --remote --file=drizzle/0003_device_topics.sql

CREATE TABLE IF NOT EXISTS `device_topics` (
  `id`          TEXT PRIMARY KEY NOT NULL,
  `device_id`   TEXT NOT NULL REFERENCES `devices`(`id`)  ON DELETE CASCADE,
  `topic_id`    TEXT NOT NULL REFERENCES `topics`(`id`)   ON DELETE CASCADE,
  `assigned_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `assigned_by` TEXT NOT NULL DEFAULT 'admin',
  UNIQUE(`device_id`, `topic_id`)
);

CREATE INDEX IF NOT EXISTS `device_topics_device_idx` ON `device_topics` (`device_id`);
CREATE INDEX IF NOT EXISTS `device_topics_topic_idx`  ON `device_topics` (`topic_id`);
