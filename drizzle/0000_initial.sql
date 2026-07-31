-- ============================================================
-- NotifyMVP — Cloudflare D1 (SQLite) initial migration
-- Run via: wrangler d1 execute notifymvp-db --file=drizzle/0000_initial.sql
-- Or apply with drizzle-kit: npx drizzle-kit migrate
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id`            TEXT PRIMARY KEY NOT NULL,
  `email`         TEXT NOT NULL UNIQUE,
  `password_hash` TEXT NOT NULL,
  `created_at`    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects table
CREATE TABLE IF NOT EXISTS `projects` (
  `id`                  TEXT PRIMARY KEY NOT NULL,
  `user_id`             TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `name`                TEXT NOT NULL,
  `app_id`              TEXT NOT NULL UNIQUE,
  `api_key`             TEXT NOT NULL,
  `firebase_json_path`  TEXT,
  `created_at`          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `projects_user_id_idx` ON `projects` (`user_id`);
CREATE INDEX IF NOT EXISTS `projects_app_id_idx`  ON `projects` (`app_id`);

-- Devices table
CREATE TABLE IF NOT EXISTS `devices` (
  `id`          TEXT PRIMARY KEY NOT NULL,
  `project_id`  TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `device_id`   TEXT NOT NULL,
  `fcm_token`   TEXT NOT NULL,
  `platform`    TEXT NOT NULL CHECK(`platform` IN ('android','ios','flutter','react-native')),
  `app_version` TEXT,
  `created_at`  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(`project_id`, `device_id`)
);

CREATE INDEX IF NOT EXISTS `devices_project_id_idx` ON `devices` (`project_id`);

-- Notifications table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`              TEXT PRIMARY KEY NOT NULL,
  `project_id`      TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `title`           TEXT NOT NULL,
  `body`            TEXT NOT NULL,
  `status`          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(`status` IN ('pending','sent','failed')),
  `recipient_count` INTEGER NOT NULL DEFAULT 0,
  `sent_at`         TEXT,
  `created_at`      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `notifications_project_id_idx` ON `notifications` (`project_id`);
CREATE INDEX IF NOT EXISTS `notifications_sent_at_idx`    ON `notifications` (`sent_at` DESC);
