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
  id:           text('id').primaryKey(),                             // UUID
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull()
                  .default(sql`(datetime('now'))`),
})

// ── Projects ──────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id:               text('id').primaryKey(),                         // UUID
  userId:           text('user_id').notNull()
                      .references(() => users.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  appId:            text('app_id').notNull().unique(),
  apiKey:           text('api_key').notNull(),
  firebaseJsonPath: text('firebase_json_path'),                      // R2 object key
  createdAt:        text('created_at').notNull()
                      .default(sql`(datetime('now'))`),
}, (t) => ({
  userIdIdx: index('projects_user_id_idx').on(t.userId),
  appIdIdx:  index('projects_app_id_idx').on(t.appId),
}))

// ── Devices ───────────────────────────────────────────────────────────────────
export const devices = sqliteTable('devices', {
  id:         text('id').primaryKey(),                               // UUID
  projectId:  text('project_id').notNull()
                .references(() => projects.id, { onDelete: 'cascade' }),
  deviceId:   text('device_id').notNull(),
  fcmToken:   text('fcm_token').notNull(),
  platform:   text('platform', {
                enum: ['android', 'ios', 'flutter', 'react-native'],
              }).notNull(),
  appVersion: text('app_version'),
  createdAt:  text('created_at').notNull()
                .default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx:           index('devices_project_id_idx').on(t.projectId),
  projectDeviceUnique:    uniqueIndex('devices_project_device_unique')
                            .on(t.projectId, t.deviceId),
}))

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id:             text('id').primaryKey(),                           // UUID
  projectId:      text('project_id').notNull()
                    .references(() => projects.id, { onDelete: 'cascade' }),
  title:          text('title').notNull(),
  body:           text('body').notNull(),
  status:         text('status', {
                    enum: ['pending', 'sent', 'failed'],
                  }).notNull().default('pending'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentAt:         text('sent_at'),
  createdAt:      text('created_at').notNull()
                    .default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx: index('notifications_project_id_idx').on(t.projectId),
  sentAtIdx:    index('notifications_sent_at_idx').on(t.sentAt),
}))

// ── TypeScript inferred types ─────────────────────────────────────────────────
export type User         = typeof users.$inferSelect
export type NewUser      = typeof users.$inferInsert
export type Project      = typeof projects.$inferSelect
export type NewProject   = typeof projects.$inferInsert
export type Device       = typeof devices.$inferSelect
export type NewDevice    = typeof devices.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
