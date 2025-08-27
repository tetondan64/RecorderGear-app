import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecordingEntry } from '../fs/indexStore';

interface QueueItem {
  id: string;
  recording: RecordingEntry;
  addedAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

/**
 * Persistent queue for managing recording uploads
 * Handles retry logic and failure recovery
 */
export class SyncQueue {
  private static readonly STORAGE_KEY = 'sync_queue';
  private static readonly MAX_RETRIES = 3;
  private queue: Map<string, QueueItem> = new Map();
  private isPaused = false;
  private isProcessing = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a recording to the sync queue
   */
  async add(recording: RecordingEntry): Promise<void> {
    const item: QueueItem = {
      id: recording.id,
      recording,
      addedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: SyncQueue.MAX_RETRIES
    };

    this.queue.set(recording.id, item);
    await this.saveToStorage();
    
    console.log(`SyncQueue: Added recording ${recording.id} to queue`);
  }

  /**
   * Remove a recording from the queue (after successful upload)
   */
  async remove(recordingId: string): Promise<void> {
    if (this.queue.delete(recordingId)) {
      await this.saveToStorage();
      console.log(`SyncQueue: Removed recording ${recordingId} from queue`);
    }
  }

  /**
   * Get the next recording to process
   */
  async getNext(): Promise<RecordingEntry | null> {
    if (this.isPaused || this.isProcessing || this.queue.size === 0) {
      return null;
    }

    // Get the oldest item that hasn't exceeded retry limit
    const items = Array.from(this.queue.values())
      .filter(item => item.retryCount < item.maxRetries)
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

    return items.length > 0 ? items[0].recording : null;
  }

  /**
   * Mark a recording as failed and increment retry count
   */
  async markFailed(recordingId: string, error: string): Promise<void> {
    const item = this.queue.get(recordingId);
    if (!item) return;

    item.retryCount++;
    item.lastError = error;

    if (item.retryCount >= item.maxRetries) {
      console.log(`SyncQueue: Recording ${recordingId} exceeded max retries, giving up`);
    } else {
      console.log(`SyncQueue: Recording ${recordingId} failed, retry ${item.retryCount}/${item.maxRetries}`);
    }

    await this.saveToStorage();
  }

  /**
   * Retry all failed recordings
   */
  async retryFailed(): Promise<void> {
    let retryCount = 0;
    
    for (const item of this.queue.values()) {
      if (item.retryCount < item.maxRetries) {
        item.retryCount = 0; // Reset retry count
        item.lastError = undefined;
        retryCount++;
      }
    }

    await this.saveToStorage();
    console.log(`SyncQueue: Reset ${retryCount} recordings for retry`);
  }

  /**
   * Get count of pending recordings
   */
  getPendingCount(): number {
    return Array.from(this.queue.values())
      .filter(item => item.retryCount < item.maxRetries).length;
  }

  /**
   * Get count of failed recordings (exceeded retry limit)
   */
  getFailedCount(): number {
    return Array.from(this.queue.values())
      .filter(item => item.retryCount >= item.maxRetries).length;
  }

  /**
   * Get all items in queue for debugging
   */
  getAllItems(): QueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    console.log('SyncQueue: Paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    console.log('SyncQueue: Resumed');
  }

  /**
   * Check if queue is paused
   */
  isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Clear entire queue (for debugging/reset)
   */
  async clear(): Promise<void> {
    this.queue.clear();
    await this.saveToStorage();
    console.log('SyncQueue: Cleared all items');
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SyncQueue.STORAGE_KEY);
      if (data) {
        const items: QueueItem[] = JSON.parse(data);
        this.queue.clear();
        
        items.forEach(item => {
          this.queue.set(item.id, item);
        });
        
        console.log(`SyncQueue: Loaded ${items.length} items from storage`);
      }
    } catch (error) {
      console.error('SyncQueue: Failed to load from storage:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const items = Array.from(this.queue.values());
      await AsyncStorage.setItem(SyncQueue.STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('SyncQueue: Failed to save to storage:', error);
    }
  }
}