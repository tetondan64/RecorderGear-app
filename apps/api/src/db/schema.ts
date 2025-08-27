import { 
  pgTable, 
  text, 
  integer, 
  uuid, 
  timestamp, 
  primaryKey,
  unique,
  index,
  boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Users table for future authentication
 * user_id is nullable throughout for development without auth
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(), // nullable for dev
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Recordings table - core entity
 * Migrated from JSON storage, keeps same structure but adds user_id for future multi-user
 */
export const recordings = pgTable('recordings', {
  id: text('id').primaryKey(), // Keep text for consistency with mobile IDs
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // nullable for dev
  title: text('title').notNull(),
  durationSec: integer('duration_sec').notNull(),
  s3Key: text('s3_key').notNull(), // S3 object key for file storage
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // For soft deletes
}, (table) => ({
  // Index for efficient user recording lookups with recency
  userCreatedAtIdx: index('recordings_user_created_at_idx').on(table.userId, table.createdAt),
}));

/**
 * Folders for organizing recordings
 * Supports 2-level hierarchy: root folders and child folders only
 */
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // nullable for dev
  name: text('name').notNull(),
  parentId: uuid('parent_id').references(() => folders.id, { onDelete: 'cascade' }), // self-reference
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // For soft deletes
}, (table) => ({
  // Unique folder names per user at same level
  userNameIdx: index('folders_user_name_idx').on(table.userId, table.name),
}));

/**
 * Tags for labeling recordings
 * Case-insensitive unique names per user
 */
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // nullable for dev
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // For soft deletes
}, (table) => ({
  // Case-insensitive unique tag names per user
  userNameUniqueIdx: unique('tags_user_name_unique').on(table.userId, table.name),
}));

/**
 * Many-to-many relationship between recordings and tags
 */
export const recordingTags = pgTable('recording_tags', {
  recordingId: text('recording_id').notNull().references(() => recordings.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // For soft deletes
}, (table) => ({
  // Composite primary key
  pk: primaryKey({ columns: [table.recordingId, table.tagId] }),
  // Index for efficient tag-based lookups
  tagIdx: index('recording_tags_tag_idx').on(table.tagId),
}));

/**
 * Folder assignment for recordings (one-to-many)
 * Using separate table for consistency and future flexibility
 */
export const recordingFolders = pgTable('recording_folders', {
  recordingId: text('recording_id').notNull().references(() => recordings.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // One recording can only be in one folder
  recordingUniqueIdx: unique('recording_folders_recording_unique').on(table.recordingId),
  // Index for folder-based lookups
  folderIdx: index('recording_folders_folder_idx').on(table.folderId),
}));

// Relations for Drizzle ORM query building
export const usersRelations = relations(users, ({ many }) => ({
  recordings: many(recordings),
  folders: many(folders),
  tags: many(tags),
}));

export const recordingsRelations = relations(recordings, ({ one, many }) => ({
  user: one(users, {
    fields: [recordings.userId],
    references: [users.id],
  }),
  recordingTags: many(recordingTags),
  recordingFolder: one(recordingFolders),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, {
    fields: [folders.userId],
    references: [users.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders),
  recordingFolders: many(recordingFolders),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  recordingTags: many(recordingTags),
}));

export const recordingTagsRelations = relations(recordingTags, ({ one }) => ({
  recording: one(recordings, {
    fields: [recordingTags.recordingId],
    references: [recordings.id],
  }),
  tag: one(tags, {
    fields: [recordingTags.tagId],
    references: [tags.id],
  }),
}));

export const recordingFoldersRelations = relations(recordingFolders, ({ one }) => ({
  recording: one(recordings, {
    fields: [recordingFolders.recordingId],
    references: [recordings.id],
  }),
  folder: one(folders, {
    fields: [recordingFolders.folderId],
    references: [folders.id],
  }),
}));

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = typeof folders.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

export type RecordingTag = typeof recordingTags.$inferSelect;
export type InsertRecordingTag = typeof recordingTags.$inferInsert;

export type RecordingFolder = typeof recordingFolders.$inferSelect;
export type InsertRecordingFolder = typeof recordingFolders.$inferInsert;

/**
 * AUTH TABLES - Phase C3 Implementation
 */

/**
 * Devices table for anonymous device registration
 * Each device gets a unique ID and can be associated with a user
 */
export const devices = pgTable('devices', {
  id: text('id').primaryKey(), // Generated device ID like "dev_abc123"
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // nullable until email upgrade
  userAgent: text('user_agent'), // Optional device info for debugging
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for finding devices by user
  userIdx: index('devices_user_idx').on(table.userId),
}));

/**
 * Refresh tokens for JWT authentication
 * Stores refresh tokens with expiration tracking
 */
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(), // Hash of the refresh token for security
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }), // nullable - null means active
}, (table) => ({
  // Composite index for token lookups
  userDeviceIdx: index('refresh_tokens_user_device_idx').on(table.userId, table.deviceId),
  // Index for cleanup of expired tokens
  expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
}));

/**
 * Email OTP tokens for email verification
 * Short-lived codes for linking email to device
 */
export const emailOtps = pgTable('email_otps', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  otpHash: text('otp_hash').notNull(), // Hashed OTP code
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }), // nullable - null means unverified
}, (table) => ({
  // Index for OTP lookups
  emailDeviceIdx: index('email_otps_email_device_idx').on(table.email, table.deviceId),
  // Index for cleanup of expired OTPs
  expiresAtIdx: index('email_otps_expires_at_idx').on(table.expiresAt),
}));

// Auth relations
export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  refreshTokens: many(refreshTokens),
  emailOtps: many(emailOtps),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
  device: one(devices, {
    fields: [refreshTokens.deviceId],
    references: [devices.id],
  }),
}));

export const emailOtpsRelations = relations(emailOtps, ({ one }) => ({
  device: one(devices, {
    fields: [emailOtps.deviceId],
    references: [devices.id],
  }),
}));

// Update users relations to include devices
export const usersRelationsUpdated = relations(users, ({ many }) => ({
  recordings: many(recordings),
  folders: many(folders),
  tags: many(tags),
  devices: many(devices),
  refreshTokens: many(refreshTokens),
}));

// Auth table type exports
export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

export type EmailOtp = typeof emailOtps.$inferSelect;
export type InsertEmailOtp = typeof emailOtps.$inferInsert;