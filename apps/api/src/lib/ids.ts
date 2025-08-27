import { randomBytes } from 'crypto';

/**
 * Generate a unique ID for recordings
 * Format: timestamp_random for better sorting and uniqueness
 */
export function generateRecordingId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `${timestamp}_${random}`;
}

/**
 * Generate S3 object key for a recording
 */
export function generateRecordingKey(id: string): string {
  return `recordings/${id}.m4a`;
}

/**
 * Extract recording ID from S3 object key
 */
export function extractIdFromKey(key: string): string | null {
  const match = key.match(/^recordings\/(.+)\.m4a$/);
  return match?.[1] ?? null;
}

/**
 * Validate recording ID format
 */
export function isValidRecordingId(id: string): boolean {
  // Format: timestamp_random (alphanumeric + underscore)
  return /^[a-z0-9_]+$/i.test(id) && id.includes('_');
}

/**
 * Validate S3 object key format
 */
export function isValidRecordingKey(key: string): boolean {
  return key.startsWith('recordings/') && key.endsWith('.m4a');
}