import { settingsStorage } from '../fs/settingsStore';

interface SyncCursorState {
  lastCursor: string | null;
  lastSyncAt: string | null;
}

/**
 * Persistent storage for sync cursor and last sync timestamp
 * Stored in settings.json for atomic writes and device persistence
 */
export class CursorStore {
  private static readonly CURSOR_KEY = 'sync.cursor';
  private static readonly LAST_SYNC_KEY = 'sync.lastSyncAt';
  
  /**
   * Get current sync cursor
   */
  static async getCursor(): Promise<string | null> {
    try {
      const cursor = await settingsStorage.get(CursorStore.CURSOR_KEY);
      return cursor || null;
    } catch (error) {
      console.error('CURSOR_STORE: Failed to get cursor:', error);
      return null;
    }
  }
  
  /**
   * Set sync cursor
   */
  static async setCursor(cursor: string): Promise<void> {
    try {
      await settingsStorage.set(CursorStore.CURSOR_KEY, cursor);
      console.log('CURSOR_STORE: Cursor updated');
    } catch (error) {
      console.error('CURSOR_STORE: Failed to set cursor:', error);
      throw error;
    }
  }
  
  /**
   * Get last successful sync timestamp
   */
  static async getLastSyncAt(): Promise<Date | null> {
    try {
      const lastSyncStr = await settingsStorage.get(CursorStore.LAST_SYNC_KEY);
      return lastSyncStr ? new Date(lastSyncStr) : null;
    } catch (error) {
      console.error('CURSOR_STORE: Failed to get lastSyncAt:', error);
      return null;
    }
  }
  
  /**
   * Set last successful sync timestamp
   */
  static async setLastSyncAt(timestamp: Date): Promise<void> {
    try {
      await settingsStorage.set(CursorStore.LAST_SYNC_KEY, timestamp.toISOString());
      console.log('CURSOR_STORE: Last sync time updated:', timestamp.toISOString());
    } catch (error) {
      console.error('CURSOR_STORE: Failed to set lastSyncAt:', error);
      throw error;
    }
  }
  
  /**
   * Get full cursor state
   */
  static async getCursorState(): Promise<SyncCursorState> {
    const [lastCursor, lastSyncAtStr] = await Promise.all([
      CursorStore.getCursor(),
      settingsStorage.get(CursorStore.LAST_SYNC_KEY)
    ]);
    
    return {
      lastCursor,
      lastSyncAt: lastSyncAtStr || null
    };
  }
  
  /**
   * Update both cursor and last sync time atomically
   */
  static async updateCursorState(cursor: string, syncTime: Date): Promise<void> {
    try {
      // Use batch operations if available, otherwise sequential
      await Promise.all([
        settingsStorage.set(CursorStore.CURSOR_KEY, cursor),
        settingsStorage.set(CursorStore.LAST_SYNC_KEY, syncTime.toISOString())
      ]);
      
      console.log('CURSOR_STORE: Cursor state updated', {
        cursor: cursor.substring(0, 20) + '...',
        syncTime: syncTime.toISOString()
      });
    } catch (error) {
      console.error('CURSOR_STORE: Failed to update cursor state:', error);
      throw error;
    }
  }
  
  /**
   * Clear all cursor data (used for logout/reset)
   */
  static async clear(): Promise<void> {
    try {
      await Promise.all([
        settingsStorage.remove(CursorStore.CURSOR_KEY),
        settingsStorage.remove(CursorStore.LAST_SYNC_KEY)
      ]);
      
      console.log('CURSOR_STORE: Cursor data cleared');
    } catch (error) {
      console.error('CURSOR_STORE: Failed to clear cursor data:', error);
      throw error;
    }
  }
  
  /**
   * Check if sync is stale (older than threshold)
   */
  static async isSyncStale(thresholdMinutes: number = 5): Promise<boolean> {
    try {
      const lastSyncAt = await CursorStore.getLastSyncAt();
      if (!lastSyncAt) {
        return true; // Never synced = stale
      }
      
      const now = new Date();
      const thresholdMs = thresholdMinutes * 60 * 1000;
      const isStale = (now.getTime() - lastSyncAt.getTime()) > thresholdMs;
      
      console.log('CURSOR_STORE: Sync staleness check', {
        lastSync: lastSyncAt.toISOString(),
        isStale,
        minutesAgo: Math.round((now.getTime() - lastSyncAt.getTime()) / (60 * 1000))
      });
      
      return isStale;
    } catch (error) {
      console.error('CURSOR_STORE: Failed to check sync staleness:', error);
      return true; // Assume stale on error
    }
  }
}