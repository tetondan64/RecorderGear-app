import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncStatusType = 'none' | 'pending' | 'uploading' | 'synced' | 'failed';

interface StatusEntry {
  recordingId: string;
  status: SyncStatusType;
  lastUpdated: string;
  error?: string;
}

/**
 * Tracks sync status for individual recordings
 * Persists status across app restarts
 */
export class SyncStatus {
  private static readonly STORAGE_KEY = 'sync_status';
  private statusMap: Map<string, StatusEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Set sync status for a recording
   */
  async setStatus(recordingId: string, status: SyncStatusType, error?: string): Promise<void> {
    const entry: StatusEntry = {
      recordingId,
      status,
      lastUpdated: new Date().toISOString(),
      error
    };

    this.statusMap.set(recordingId, entry);
    await this.saveToStorage();

    console.log(`SyncStatus: ${recordingId} -> ${status}${error ? ` (${error})` : ''}`);
  }

  /**
   * Get sync status for a recording
   */
  getStatus(recordingId: string): SyncStatusType {
    const entry = this.statusMap.get(recordingId);
    return entry?.status || 'none';
  }

  /**
   * Get full status entry for a recording
   */
  getStatusEntry(recordingId: string): StatusEntry | undefined {
    return this.statusMap.get(recordingId);
  }

  /**
   * Remove status for a recording
   */
  async removeStatus(recordingId: string): Promise<void> {
    if (this.statusMap.delete(recordingId)) {
      await this.saveToStorage();
      console.log(`SyncStatus: Removed status for ${recordingId}`);
    }
  }

  /**
   * Get count of recordings with specific status
   */
  getStatusCount(status: SyncStatusType): number {
    return Array.from(this.statusMap.values())
      .filter(entry => entry.status === status).length;
  }

  /**
   * Get count of recordings with errors
   */
  getErrorCount(): number {
    return this.getStatusCount('failed');
  }

  /**
   * Get count of synced recordings
   */
  getSyncedCount(): number {
    return this.getStatusCount('synced');
  }

  /**
   * Get count of pending/uploading recordings
   */
  getPendingCount(): number {
    return this.getStatusCount('pending') + this.getStatusCount('uploading');
  }

  /**
   * Get all recordings with a specific status
   */
  getRecordingsByStatus(status: SyncStatusType): string[] {
    return Array.from(this.statusMap.values())
      .filter(entry => entry.status === status)
      .map(entry => entry.recordingId);
  }

  /**
   * Get all failed recordings with error messages
   */
  getFailedRecordings(): Array<{ recordingId: string; error: string; lastUpdated: string }> {
    return Array.from(this.statusMap.values())
      .filter(entry => entry.status === 'failed' && entry.error)
      .map(entry => ({
        recordingId: entry.recordingId,
        error: entry.error!,
        lastUpdated: entry.lastUpdated
      }));
  }

  /**
   * Clear all status entries (for debugging/reset)
   */
  async clearAll(): Promise<void> {
    this.statusMap.clear();
    await this.saveToStorage();
    console.log('SyncStatus: Cleared all status entries');
  }

  /**
   * Get overall sync statistics
   */
  getStats(): {
    total: number;
    synced: number;
    pending: number;
    failed: number;
    none: number;
  } {
    const entries = Array.from(this.statusMap.values());
    const stats = {
      total: entries.length,
      synced: 0,
      pending: 0,
      failed: 0,
      none: 0
    };

    entries.forEach(entry => {
      switch (entry.status) {
        case 'synced':
          stats.synced++;
          break;
        case 'pending':
        case 'uploading':
          stats.pending++;
          break;
        case 'failed':
          stats.failed++;
          break;
        default:
          stats.none++;
      }
    });

    return stats;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SyncStatus.STORAGE_KEY);
      if (data) {
        const entries: StatusEntry[] = JSON.parse(data);
        this.statusMap.clear();
        
        entries.forEach(entry => {
          this.statusMap.set(entry.recordingId, entry);
        });
        
        console.log(`SyncStatus: Loaded ${entries.length} status entries from storage`);
      }
    } catch (error) {
      console.error('SyncStatus: Failed to load from storage:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const entries = Array.from(this.statusMap.values());
      await AsyncStorage.setItem(SyncStatus.STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('SyncStatus: Failed to save to storage:', error);
    }
  }
}