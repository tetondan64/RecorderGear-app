import { SyncQueue } from '../src/lib/sync/SyncQueue';
import { SyncStore } from '../src/lib/fs/syncStore';
import type { SyncQueueItem, SyncStatus } from '../src/lib/sync/types';

// Mock SyncStore
jest.mock('../src/lib/fs/syncStore');
const mockSyncStore = SyncStore as jest.Mocked<typeof SyncStore>;

describe('SyncQueue', () => {
  let syncQueue: SyncQueue;

  const createQueueItem = (id: string, status: SyncStatus = 'queued', attemptCount = 0): SyncQueueItem => ({
    recordingId: id,
    asset: 'audio',
    status,
    progressPct: 0,
    attemptCount,
    lastError: null,
    updatedAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSyncStore.readQueue.mockResolvedValue([]);
    mockSyncStore.writeQueue.mockResolvedValue();
    
    syncQueue = new SyncQueue();
    await syncQueue.initialize();
  });

  describe('Initialization', () => {
    it('should load existing queue from storage', async () => {
      const existingItems = [
        createQueueItem('rec1', 'queued'),
        createQueueItem('rec2', 'uploading'),
      ];
      
      mockSyncStore.readQueue.mockResolvedValue(existingItems);
      
      const newQueue = new SyncQueue();
      await newQueue.initialize();
      
      expect(newQueue.size()).toBe(2);
      expect(newQueue.getItem('rec1')?.status).toBe('queued');
      expect(newQueue.getItem('rec2')?.status).toBe('uploading');
    });

    it('should handle empty queue gracefully', async () => {
      mockSyncStore.readQueue.mockResolvedValue([]);
      
      const newQueue = new SyncQueue();
      await newQueue.initialize();
      
      expect(newQueue.size()).toBe(0);
      expect(newQueue.getNext()).toBeNull();
    });

    it('should handle corrupted storage data', async () => {
      mockSyncStore.readQueue.mockRejectedValue(new Error('Corrupted data'));
      
      const newQueue = new SyncQueue();
      await newQueue.initialize();
      
      expect(newQueue.size()).toBe(0);
    });
  });

  describe('Enqueue/Dequeue operations', () => {
    it('should enqueue new items correctly', async () => {
      const item = createQueueItem('rec1');
      
      await syncQueue.enqueue(item);
      
      expect(syncQueue.size()).toBe(1);
      expect(syncQueue.getItem('rec1')).toEqual(item);
      expect(mockSyncStore.writeQueue).toHaveBeenCalled();
    });

    it('should update existing items when re-enqueued', async () => {
      const original = createQueueItem('rec1', 'failed', 2);
      await syncQueue.enqueue(original);
      
      const updated = createQueueItem('rec1', 'queued', 0);
      await syncQueue.enqueue(updated);
      
      expect(syncQueue.size()).toBe(1);
      expect(syncQueue.getItem('rec1')?.status).toBe('queued');
      expect(syncQueue.getItem('rec1')?.attemptCount).toBe(0);
    });

    it('should dequeue items in FIFO order', async () => {
      await syncQueue.enqueue(createQueueItem('rec1'));
      await syncQueue.enqueue(createQueueItem('rec2'));
      await syncQueue.enqueue(createQueueItem('rec3'));
      
      const first = syncQueue.getNext();
      const second = syncQueue.getNext();
      
      expect(first?.recordingId).toBe('rec1');
      expect(second?.recordingId).toBe('rec2');
    });

    it('should skip uploading items when getting next', async () => {
      await syncQueue.enqueue(createQueueItem('rec1', 'uploading'));
      await syncQueue.enqueue(createQueueItem('rec2', 'queued'));
      
      const next = syncQueue.getNext();
      expect(next?.recordingId).toBe('rec2');
    });

    it('should skip failed items that exceeded max attempts', async () => {
      await syncQueue.enqueue(createQueueItem('rec1', 'failed', 5)); // Over limit
      await syncQueue.enqueue(createQueueItem('rec2', 'failed', 2)); // Under limit
      await syncQueue.enqueue(createQueueItem('rec3', 'queued'));
      
      const next = syncQueue.getNext();
      expect(next?.recordingId).toBe('rec2'); // Should skip rec1, process rec2
    });
  });

  describe('State transitions', () => {
    it('should update item status correctly', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      await syncQueue.updateItem('rec1', { status: 'uploading', progressPct: 50 });
      
      const updated = syncQueue.getItem('rec1');
      expect(updated?.status).toBe('uploading');
      expect(updated?.progressPct).toBe(50);
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(2);
    });

    it('should increment attempt count on failure', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      await syncQueue.markFailed('rec1', 'Network error');
      
      const failed = syncQueue.getItem('rec1');
      expect(failed?.status).toBe('failed');
      expect(failed?.attemptCount).toBe(1);
      expect(failed?.lastError).toBe('Network error');
    });

    it('should remove completed items', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      await syncQueue.markCompleted('rec1');
      
      expect(syncQueue.getItem('rec1')).toBeUndefined();
      expect(syncQueue.size()).toBe(0);
    });

    it('should persist state after every transition', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      mockSyncStore.writeQueue.mockClear();
      
      await syncQueue.updateItem('rec1', { status: 'uploading' });
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(1);
      
      await syncQueue.markFailed('rec1', 'Error');
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(2);
      
      await syncQueue.markCompleted('rec1');
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(3);
    });
  });

  describe('Idempotency checks', () => {
    it('should not re-enqueue already synced recordings', async () => {
      const syncedItem = createQueueItem('rec1', 'synced');
      await syncQueue.enqueue(syncedItem);
      
      // Try to enqueue again
      const newItem = createQueueItem('rec1', 'queued');
      await syncQueue.enqueue(newItem);
      
      // Should remain synced
      expect(syncQueue.getItem('rec1')?.status).toBe('synced');
    });

    it('should allow re-enqueue of failed items', async () => {
      const failedItem = createQueueItem('rec1', 'failed', 2);
      await syncQueue.enqueue(failedItem);
      
      const retryItem = createQueueItem('rec1', 'queued', 0);
      await syncQueue.enqueue(retryItem);
      
      expect(syncQueue.getItem('rec1')?.status).toBe('queued');
      expect(syncQueue.getItem('rec1')?.attemptCount).toBe(0);
    });

    it('should prevent duplicate uploads of same recording', async () => {
      const item1 = createQueueItem('rec1', 'uploading');
      const item2 = createQueueItem('rec1', 'queued');
      
      await syncQueue.enqueue(item1);
      await syncQueue.enqueue(item2);
      
      // Should remain uploading, not change to queued
      expect(syncQueue.getItem('rec1')?.status).toBe('uploading');
    });
  });

  describe('Queue management', () => {
    it('should provide accurate size and statistics', async () => {
      await syncQueue.enqueue(createQueueItem('rec1', 'queued'));
      await syncQueue.enqueue(createQueueItem('rec2', 'uploading'));
      await syncQueue.enqueue(createQueueItem('rec3', 'failed', 1));
      await syncQueue.enqueue(createQueueItem('rec4', 'synced'));
      
      expect(syncQueue.size()).toBe(4);
      expect(syncQueue.getQueuedCount()).toBe(1);
      expect(syncQueue.getUploadingCount()).toBe(1);
      expect(syncQueue.getFailedCount()).toBe(1);
      expect(syncQueue.getSyncedCount()).toBe(1);
    });

    it('should clear completed items on cleanup', async () => {
      await syncQueue.enqueue(createQueueItem('rec1', 'synced'));
      await syncQueue.enqueue(createQueueItem('rec2', 'queued'));
      await syncQueue.enqueue(createQueueItem('rec3', 'synced'));
      
      await syncQueue.cleanup();
      
      expect(syncQueue.size()).toBe(1);
      expect(syncQueue.getItem('rec2')).toBeDefined();
      expect(syncQueue.getItem('rec1')).toBeUndefined();
      expect(syncQueue.getItem('rec3')).toBeUndefined();
    });

    it('should handle concurrent modifications safely', async () => {
      const promises = [];
      
      // Simulate concurrent enqueue operations
      for (let i = 0; i < 10; i++) {
        promises.push(syncQueue.enqueue(createQueueItem(`rec${i}`)));
      }
      
      await Promise.all(promises);
      
      expect(syncQueue.size()).toBe(10);
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error handling', () => {
    it('should handle storage write failures gracefully', async () => {
      mockSyncStore.writeQueue.mockRejectedValue(new Error('Storage full'));
      
      const item = createQueueItem('rec1');
      
      await expect(syncQueue.enqueue(item)).rejects.toThrow('Storage full');
      // But internal state should still be updated
      expect(syncQueue.getItem('rec1')).toEqual(item);
    });

    it('should recover from corrupted queue data', async () => {
      // Simulate corrupted data that gets filtered out
      const corruptedData = [
        createQueueItem('rec1'), // Valid
        { invalid: 'data' }, // Invalid
        createQueueItem('rec2'), // Valid
      ];
      
      mockSyncStore.readQueue.mockResolvedValue(corruptedData as any);
      
      const newQueue = new SyncQueue();
      await newQueue.initialize();
      
      expect(newQueue.size()).toBe(2);
      expect(newQueue.getItem('rec1')).toBeDefined();
      expect(newQueue.getItem('rec2')).toBeDefined();
    });

    it('should handle missing recordings in queue gracefully', async () => {
      await syncQueue.enqueue(createQueueItem('nonexistent_rec'));
      
      const next = syncQueue.getNext();
      expect(next?.recordingId).toBe('nonexistent_rec');
      
      // Should handle gracefully when recording file doesn't exist
    });
  });

  describe('Retry logic', () => {
    it('should implement correct retry delays', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      const retryDelays = [1000, 3000, 7000, 15000];
      
      for (let i = 0; i < retryDelays.length; i++) {
        await syncQueue.markFailed('rec1', `Attempt ${i + 1} failed`);
        
        const failedItem = syncQueue.getItem('rec1');
        expect(failedItem?.attemptCount).toBe(i + 1);
        
        const nextRetry = syncQueue.getNextRetryTime('rec1');
        expect(nextRetry).toBeGreaterThan(Date.now() + retryDelays[i] - 100);
      }
    });

    it('should stop retrying after max attempts', async () => {
      const item = createQueueItem('rec1');
      await syncQueue.enqueue(item);
      
      // Exceed max retry attempts
      for (let i = 0; i < 5; i++) {
        await syncQueue.markFailed('rec1', `Failure ${i + 1}`);
      }
      
      const failedItem = syncQueue.getItem('rec1');
      expect(failedItem?.attemptCount).toBe(5);
      
      // Should not be included in next items
      const next = syncQueue.getNext();
      expect(next).toBeNull();
    });

    it('should allow manual retry of failed items', async () => {
      const item = createQueueItem('rec1', 'failed', 3);
      await syncQueue.enqueue(item);
      
      await syncQueue.retryItem('rec1');
      
      const retried = syncQueue.getItem('rec1');
      expect(retried?.status).toBe('queued');
      expect(retried?.attemptCount).toBe(0);
      expect(retried?.lastError).toBeNull();
    });
  });
});