/**
 * Drizzle ORM schema for Cloudflare D1 (SQLite).
 * Replaces supabase/schema.sql
 */

import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Projects ──────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id:               text('id').primaryKey(),
  userId:           text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  appId:            text('app_id').notNull().unique(),
  apiKey:           text('api_key').notNull(),
  firebaseJsonPath: text('firebase_json_path'),
  createdAt:        text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdIdx: index('projects_user_id_idx').on(t.userId),
  appIdIdx:  index('projects_app_id_idx').on(t.appId),
}))

// ── Devices ───────────────────────────────────────────────────────────────────
export const devices = sqliteTable('devices', {
  id:                 text('id').primaryKey(),
  projectId:          text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  deviceId:           text('device_id').notNull(),
  fcmToken:           text('fcm_token').notNull(),
  platform:           text('platform', {
                        enum: ['android', 'ios', 'flutter', 'react-native'],
                      }).notNull(),
  // Enhanced device info (OneSignal-like)
  appVersion:         text('app_version'),
  deviceModel:        text('device_model'),       // e.g. "Samsung Galaxy S24"
  deviceOs:           text('device_os'),           // e.g. "Android 14"
  language:           text('language'),            // e.g. "en", "ur"
  timezone:           text('timezone'),            // e.g. "Asia/Karachi"
  externalUserId:     text('external_user_id'),    // developer's own user ID
  sdkVersion:         text('sdk_version'),         // e.g. "1.0.0"
  subscriptionStatus: text('subscription_status', {
                        enum: ['subscribed', 'unsubscribed'],
                      }).notNull().default('subscribed'),
  lastActive:         text('last_active').notNull().default(sql`(datetime('now'))`),
  createdAt:          text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx:        index('devices_project_id_idx').on(t.projectId),
  projectDeviceUnique: uniqueIndex('devices_project_device_unique').on(t.projectId, t.deviceId),
  externalUserIdx:     index('devices_external_user_idx').on(t.projectId, t.externalUserId),
}))

// ── Topics ────────────────────────────────────────────────────────────────────
// Tracks custom topics created per project for the dashboard
export const topics = sqliteTable('topics', {
  id:        text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),   // e.g. "sports", "breaking_news"
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectTopicUnique: uniqueIndex('topics_project_name_unique').on(t.projectId, t.name),
  projectIdIdx:       index('topics_project_id_idx').on(t.projectId),
}))

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id:             text('id').primaryKey(),
  projectId:      text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title:          text('title').notNull(),
  body:           text('body').notNull(),
  // target: 'all' | 'android' | 'ios' | 'flutter' | 'react-native' | 'topic:{name}' | 'tokens'
  target:         text('target').notNull().default('all'),
  status:         text('status', {
                    enum: ['pending', 'sent', 'failed'],
                  }).notNull().default('pending'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentAt:         text('sent_at'),
  createdAt:      text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx: index('notifications_project_id_idx').on(t.projectId),
  sentAtIdx:    index('notifications_sent_at_idx').on(t.sentAt),
}))

// ── TypeScript inferred types ─────────────────────────────────────────────────
export type User            = typeof users.$inferSelect
export type NewUser         = typeof users.$inferInsert
export type Project         = typeof projects.$inferSelect
export type NewProject      = typeof projects.$inferInsert
export type Device          = typeof devices.$inferSelect
export type NewDevice       = typeof devices.$inferInsert
export type Topic           = typeof topics.$inferSelect
export type NewTopic        = typeof topics.$inferInsert
export type Notification    = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
