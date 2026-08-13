-- Add missing columns to notification_campaigns table in Cloudflare D1
ALTER TABLE `notification_campaigns` ADD COLUMN `image_url` TEXT;
ALTER TABLE `notification_campaigns` ADD COLUMN `url` TEXT;
ALTER TABLE `notification_campaigns` ADD COLUMN `target` TEXT NOT NULL DEFAULT 'all';
ALTER TABLE `notification_campaigns` ADD COLUMN `recipient_count` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `notification_campaigns` ADD COLUMN `sent_at` TEXT;
