/**
 * Atomic JSON read/write operations for sync queue persistence
 * Handles sync queue and settings with atomic file operations
 */

import * as FileSystem from 'expo-file-system';
import type { SyncQueueItem, CloudSettings } from '../sync/types';

const SYNC_QUEUE_FILE = `${FileSystem.documentDirectory}meta/sync.json`;
const SETTINGS_FILE = `${FileSystem.documentDirectory}meta/settings.json`;

// Ensure meta directory exists
async function ensureMetaDirectory(): Promise<void> {
  const metaDir = `${FileSystem.documentDirectory}meta/`;
  const dirInfo = await FileSystem.getInfoAsync(metaDir);
  
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(metaDir, { intermediates: true });
  }
}

/**
 * Atomic JSON operations for sync queue
 */
export class SyncStore {
  private static writeLock = new Set<string>();

  /**
   * Read sync queue from persistent storage
   */
  static async readQueue(): Promise<SyncQueueItem[]> {
    try {
      await ensureMetaDirectory();
      
      const fileInfo = await FileSystem.getInfoAsync(SYNC_QUEUE_FILE);
      if (!fileInfo.exists) {
        return [];
      }

      const content = await FileSystem.readAsStringAsync(SYNC_QUEUE_FILE);
      if (!content.trim()) {
        return [];
      }

      const data = JSON.parse(content);
      
      // Validate structure
      if (!Array.isArray(data)) {
        console.warn('SyncStore: Invalid queue format, resetting');
        return [];
      }

      return data.filter(this.isValidQueueItem);
    } catch (error) {
      console.error('SyncStore: Failed to read queue:', error);
      return [];
    }
  }

  /**
   * Write sync queue to persistent storage atomically
   */
  static async writeQueue(items: SyncQueueItem[]): Promise<void> {
    const lockKey = 'queue';
    
    if (this.writeLock.has(lockKey)) {
      console.warn('SyncStore: Write already in progress for queue');
      return;
    }

    try {
      this.writeLock.add(lockKey);
      await ensureMetaDirectory();

      // Validate all items before writing
      const validItems = items.filter(this.isValidQueueItem);
      
      const content = JSON.stringify(validItems, null, 2);
      const tempFile = `${SYNC_QUEUE_FILE}.tmp`;

      // Atomic write: write to temp file, then rename
      await FileSystem.writeAsStringAsync(tempFile, content);
      await FileSystem.moveAsync({
        from: tempFile,
        to: SYNC_QUEUE_FILE,
      });

      console.log(`SyncStore: Successfully wrote ${validItems.length} queue items`);
    } catch (error) {
      console.error('SyncStore: Failed to write queue:', error);
      throw error;
    } finally {
      this.writeLock.delete(lockKey);
    }
  }

  /**
   * Read cloud settings from persistent storage
   */
  static async readSettings(): Promise<CloudSettings> {
    try {
      await ensureMetaDirectory();
      
      const fileInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
      if (!fileInfo.exists) {
        return this.getDefaultSettings();
      }

      const content = await FileSystem.readAsStringAsync(SETTINGS_FILE);
      if (!content.trim()) {
        return this.getDefaultSettings();
      }

      const data = JSON.parse(content);
      
      // Merge with defaults to handle missing fields
      return {
        ...this.getDefaultSettings(),
        ...data,
      };
    } catch (error) {
      console.error('SyncStore: Failed to read settings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Write cloud settings to persistent storage atomically
   */
  static async writeSettings(settings: CloudSettings): Promise<void> {
    const lockKey = 'settings';
    
    if (this.writeLock.has(lockKey)) {
      console.warn('SyncStore: Write already in progress for settings');
      return;
    }

    try {
      this.writeLock.add(lockKey);
      await ensureMetaDirectory();

      const content = JSON.stringify(settings, null, 2);
      const tempFile = `${SETTINGS_FILE}.tmp`;

      // Atomic write: write to temp file, then rename
      await FileSystem.writeAsStringAsync(tempFile, content);
      await FileSystem.moveAsync({
        from: tempFile,
        to: SETTINGS_FILE,
      });

      console.log('SyncStore: Successfully wrote settings');
    } catch (error) {
      console.error('SyncStore: Failed to write settings:', error);
      throw error;
    } finally {
      this.writeLock.delete(lockKey);
    }
  }

  /**
   * Get default cloud settings
   */
  static getDefaultSettings(): CloudSettings {
    return {
      autoSyncEnabled: true,
      wifiOnly: false,
      paused: false,
    };
  }

  /**
   * Clear all persistent data (for debugging/reset)
   */
  static async clearAll(): Promise<void> {
    try {
      const queueInfo = await FileSystem.getInfoAsync(SYNC_QUEUE_FILE);
      if (queueInfo.exists) {
        await FileSystem.deleteAsync(SYNC_QUEUE_FILE);
      }

      const settingsInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
      if (settingsInfo.exists) {
        await FileSystem.deleteAsync(SETTINGS_FILE);
      }

      console.log('SyncStore: Cleared all persistent data');
    } catch (error) {
      console.error('SyncStore: Failed to clear data:', error);
    }
  }

  /**
   * Get storage info for debugging
   */
  static async getStorageInfo(): Promise<{
    queueSize: number;
    queueFileExists: boolean;
    settingsFileExists: boolean;
    metaDirExists: boolean;
  }> {
    try {
      const queue = await this.readQueue();
      const queueInfo = await FileSystem.getInfoAsync(SYNC_QUEUE_FILE);
      const settingsInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
      const metaDirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}meta/`);

      return {
        queueSize: queue.length,
        queueFileExists: queueInfo.exists,
        settingsFileExists: settingsInfo.exists,
        metaDirExists: metaDirInfo.exists,
      };
    } catch (error) {
      console.error('SyncStore: Failed to get storage info:', error);
      return {
        queueSize: 0,
        queueFileExists: false,
        settingsFileExists: false,
        metaDirExists: false,
      };
    }
  }

  private static isValidQueueItem(item: any): item is SyncQueueItem {
    return (
      item &&
      typeof item.recordingId === 'string' &&
      item.asset === 'audio' &&
      ['local', 'queued', 'uploading', 'synced', 'failed'].includes(item.status) &&
      typeof item.progressPct === 'number' &&
      typeof item.attemptCount === 'number' &&
      (item.lastError === null || typeof item.lastError === 'string') &&
      typeof item.updatedAt === 'string'
    );
  }
}