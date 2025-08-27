export interface RecordingMetadata {
  id: string;
  key: string;
  title: string;
  durationSec: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RecordingResponse {
  id: string;
  title: string;
  durationSec: number;
  createdAt: string;
  fileUrl: string;
}

export interface PresignRequest {
  id: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignResponse {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  key: string;
  expiresSec: number;
}

export interface FinalizeRequest {
  id: string;
  key: string;
  title: string;
  durationSec: number;
  createdAt: string;
  updatedAt?: string;
}

export interface FinalizeResponse {
  id: string;
}

export interface HealthResponse {
  ok: boolean;
  storage: string;
  db?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface DatabaseState {
  recordings: RecordingMetadata[];
}

export interface Environment {
  PORT: number;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
  S3_FORCE_PATH_STYLE: boolean;
  PRESIGN_EXPIRES_SEC: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  DB_SSL: boolean;
}

// Zod schemas for request/response validation
import { z } from 'zod';

export const presignRequestSchema = z.object({
  id: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().min(0),
});

export const finalizeRequestSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string().min(1).max(255),
  durationSec: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const folderCreateSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
});

export const folderUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().optional(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(50),
});

export const tagUpdateSchema = z.object({
  name: z.string().min(1).max(50),
});

export const recordingTagAssignSchema = z.object({
  recordingId: z.string().min(1),
  tagId: z.string().uuid(),
  op: z.enum(['add', 'remove']),
});

export const recordingFolderAssignSchema = z.object({
  recordingId: z.string().min(1),
  folderId: z.string().uuid().nullable(),
});

// Response types for new endpoints
export interface FolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  recordingCount?: number;
}

export interface TagResponse {
  id: string;
  name: string;
  createdAt: string;
  usageCount?: number;
}

export interface RecordingWithMetaResponse extends RecordingResponse {
  folderId?: string;
  tagIds?: string[];
}

// Auth API Types
export interface DeviceRegisterRequest {
  userAgent?: string;
}

export interface DeviceRegisterResponse {
  userId: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  accessExpiresInSec: number;
}

export interface EmailOtpRequest {
  email: string;
  deviceId: string;
}

export interface EmailOtpResponse {
  message: string;
  expiresInSec: number;
  otp?: string; // Only included in development mode
}

export interface EmailVerifyRequest {
  email: string;
  deviceId: string;
  otp: string;
}

export interface EmailVerifyResponse {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}