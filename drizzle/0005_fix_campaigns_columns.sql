-- Create notification_campaigns table if it does not exist
CREATE TABLE IF NOT EXISTS `notification_campaigns` (
  `id`              TEXT PRIMARY KEY NOT NULL,
  `project_id`      TEXT NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `name`            TEXT NOT NULL,
  `title`           TEXT NOT NULL,
  `body`            TEXT NOT NULL,
  `image`           TEXT,
  `image_url`       TEXT,
  `url`             TEXT,
  `icon`            TEXT,
  `badge`           INTEGER,
  `sound`           TEXT,
  `deep_link`       TEXT,
  `click_action`    TEXT,
  `target`          TEXT NOT NULL DEFAULT 'all',
  `priority`        TEXT NOT NULL DEFAULT 'high',
  `ttl`             INTEGER NOT NULL DEFAULT 86400,
  `channel_id`      TEXT,
  `data`            TEXT,
  `target_type`     TEXT NOT NULL DEFAULT 'topic',
  `target_value`    TEXT NOT NULL DEFAULT 'all_users',
  `status`          TEXT NOT NULL DEFAULT 'completed',
  `recipient_count` INTEGER NOT NULL DEFAULT 0,
  `sent_count`      INTEGER NOT NULL DEFAULT 0,
  `failure_count`   INTEGER NOT NULL DEFAULT 0,
  `open_count`      INTEGER NOT NULL DEFAULT 0,
  `click_count`     INTEGER NOT NULL DEFAULT 0,
  `sent_at`         TEXT,
  `created_at`      TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at`      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS `campaigns_project_id_idx` ON `notification_campaigns` (`project_id`);
CREATE INDEX IF NOT EXISTS `campaigns_status_idx`     ON `notification_campaigns` (`status`);
