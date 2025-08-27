/**
 * Sync system type definitions
 * Unified types for queue, status tracking, and sync operations
 */

export type SyncStatus = 'local' | 'queued' | 'uploading' | 'synced' | 'failed';

export interface SyncQueueItem {
  recordingId: string;
  asset: 'audio';
  status: SyncStatus;
  progressPct: number;
  attemptCount: number;
  lastError: string | null;
  updatedAt: string; // ISO string
}

export interface SyncProgressUpdate {
  recordingId: string;
  progress: number; // 0-100
  phase: 'queued' | 'uploading' | 'finalizing' | 'completed' | 'failed';
  message?: string;
  error?: string;
}

export interface SyncStats {
  total: number;
  local: number;
  queued: number;
  uploading: number;
  synced: number;
  failed: number;
}

export interface SyncManagerState {
  isActive: boolean;
  isPaused: boolean;
  currentUploads: number;
  queueSize: number;
  lastError?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number[]; // [1000, 3000, 7000, 15000]
}

export interface CloudSettings {
  autoSyncEnabled: boolean;
  wifiOnly: boolean;
  paused: boolean;
}

export type SyncTrigger = 
  | 'new_recording'
  | 'app_active' 
  | 'connectivity_online'
  | 'manual_retry'
  | 'settings_changed';

export type NetworkType = 'WIFI' | 'CELLULAR' | 'NONE' | 'UNKNOWN';

// Event types for sync manager
export type SyncEvent = 'started' | 'progress' | 'completed' | 'failed' | 'paused' | 'resumed';

export interface SyncEventPayload {
  recordingId: string;
  trigger: SyncTrigger;
  progress?: number;
  error?: string;
  timestamp: string;
}