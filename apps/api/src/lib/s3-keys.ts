/**
 * S3 key generation utilities with user scoping support
 */

/**
 * Generate S3 key for user-scoped recordings
 * Phase C3: All recordings are now scoped to users
 */
export const generateUserRecordingKey = (userId: string, recordingId: string): string => {
  return `u/${userId}/recordings/${recordingId}.m4a`;
};

/**
 * Legacy recording key generator (for backward compatibility)
 * @deprecated Use generateUserRecordingKey for new recordings
 */
export const generateLegacyRecordingKey = (recordingId: string): string => {
  return `recordings/${recordingId}.m4a`;
};

/**
 * Extract user ID from a user-scoped S3 key
 * Returns null if key is not user-scoped
 */
export const extractUserIdFromKey = (key: string): string | null => {
  const match = key.match(/^u\/([a-f0-9-]+)\/recordings\/(.+)\.m4a$/);
  return match ? match[1] : null;
};

/**
 * Extract recording ID from any recording S3 key
 */
export const extractRecordingIdFromKey = (key: string): string | null => {
  // User-scoped key: u/{userId}/recordings/{recordingId}.m4a
  const userScopedMatch = key.match(/^u\/[a-f0-9-]+\/recordings\/(.+)\.m4a$/);
  if (userScopedMatch) {
    return userScopedMatch[1];
  }
  
  // Legacy key: recordings/{recordingId}.m4a
  const legacyMatch = key.match(/^recordings\/(.+)\.m4a$/);
  if (legacyMatch) {
    return legacyMatch[1];
  }
  
  return null;
};

/**
 * Check if a key is user-scoped
 */
export const isUserScopedKey = (key: string): boolean => {
  return key.startsWith('u/') && key.includes('/recordings/');
};

/**
 * Migrate legacy key to user-scoped key
 */
export const migrateKeyToUserScoped = (legacyKey: string, userId: string): string => {
  const recordingId = extractRecordingIdFromKey(legacyKey);
  if (!recordingId) {
    throw new Error(`Invalid recording key format: ${legacyKey}`);
  }
  return generateUserRecordingKey(userId, recordingId);
};