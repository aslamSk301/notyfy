-- ============================================================
-- NotifyMVP — Migration 0004
-- OneSignal-grade Push Notification Architecture
-- ============================================================

-- Ensure device_subscriptions / devices columns
ALTER TABLE `devices` ADD COLUMN `user_id` TEXT;
ALTER TABLE `devices` ADD COLUMN `country` TEXT;
ALTER TABLE `devices` ADD COLUMN `notification_permission` TEXT NOT NULL DEFAULT 'granted';
ALTER TABLE `devices` ADD COLUMN `status` TEXT NOT NULL DEFAULT 'active';
ALTER TABLE `devices` ADD COLUMN `last_token_update` TEXT DEFAULT (datetime('now'));
ALTER TABLE `devices` ADD COLUMN `inactive_at` TEXT;
ALTER TABLE `devices` ADD COLUMN `updated_at` TEXT DEFAULT (datetime('now'));

-- Ensure topics columns
ALTER TABLE `topics` ADD COLUMN `type` TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE `topics` ADD COLUMN `updated_at` TEXT DEFAULT (datetime('now'));

-- Dynamic User Segments
CREATE TABLE IF NOT EXISTS `segments` (
  `id`          TEXT PRIMARY KEY NOT NULL,
  `project_id`  TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `name`        TEXT NOT NULL,
  `description` TEXT,
  `created_at`  TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at`  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `segments_project_id_idx` ON `segments` (`project_id`);

CREATE TABLE IF NOT EXISTS `segment_rules` (
  `id`         TEXT PRIMARY KEY NOT NULL,
  `segment_id` TEXT NOT NULL REFERENCES `segments`(`id`) ON DELETE CASCADE,
  `field`      TEXT NOT NULL,
  `operator`   TEXT NOT NULL,
  `value`      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS `segment_rules_segment_idx` ON `segment_rules` (`segment_id`);

-- Notification Campaigns
CREATE TABLE IF NOT EXISTS `notification_campaigns` (
  `id`            TEXT PRIMARY KEY NOT NULL,
  `project_id`    TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `name`          TEXT NOT NULL,
  `title`         TEXT NOT NULL,
  `body`          TEXT NOT NULL,
  `image`         TEXT,
  `icon`          TEXT,
  `badge`         INTEGER,
  `sound`         TEXT,
  `deep_link`     TEXT,
  `click_action`  TEXT,
  `priority`      TEXT NOT NULL DEFAULT 'high',
  `ttl`           INTEGER NOT NULL DEFAULT 86400,
  `channel_id`    TEXT,
  `data`          TEXT,
  `target_type`   TEXT NOT NULL,
  `target_value`  TEXT NOT NULL,
  `status`        TEXT NOT NULL DEFAULT 'queued',
  `sent_count`    INTEGER NOT NULL DEFAULT 0,
  `failure_count` INTEGER NOT NULL DEFAULT 0,
  `open_count`    INTEGER NOT NULL DEFAULT 0,
  `click_count`   INTEGER NOT NULL DEFAULT 0,
  `created_at`    TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at`    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `campaigns_project_id_idx` ON `notification_campaigns` (`project_id`);
CREATE INDEX IF NOT EXISTS `campaigns_status_idx`     ON `notification_campaigns` (`status`);

-- Notification Logs
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id`            TEXT PRIMARY KEY NOT NULL,
  `campaign_id`   TEXT NOT NULL REFERENCES `notification_campaigns`(`id`) ON DELETE CASCADE,
  `device_id`     TEXT REFERENCES `devices`(`id`) ON DELETE SET NULL,
  `fcm_token`     TEXT NOT NULL,
  `status`        TEXT NOT NULL DEFAULT 'queued',
  `error_code`    TEXT,
  `retry_count`   INTEGER NOT NULL DEFAULT 0,
  `last_retry_at` TEXT,
  `next_retry_at` TEXT,
  `sent_at`       TEXT,
  `delivered_at`  TEXT,
  `created_at`    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `logs_campaign_idx`  ON `notification_logs` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `logs_device_idx`    ON `notification_logs` (`device_id`);
CREATE INDEX IF NOT EXISTS `logs_fcm_token_idx` ON `notification_logs` (`fcm_token`);
CREATE INDEX IF NOT EXISTS `logs_status_idx`    ON `notification_logs` (`status`);

-- Notification Events
CREATE TABLE IF NOT EXISTS `notification_events` (
  `id`              TEXT PRIMARY KEY NOT NULL,
  `notification_id` TEXT,
  `campaign_id`     TEXT NOT NULL REFERENCES `notification_campaigns`(`id`) ON DELETE CASCADE,
  `device_id`       TEXT,
  `user_id`         TEXT,
  `event_type`      TEXT NOT NULL,
  `timestamp`       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `events_campaign_idx` ON `notification_events` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `events_type_idx`     ON `notification_events` (`event_type`);
