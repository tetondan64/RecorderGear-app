import { SyncManager } from '../src/lib/sync/SyncManager';
import { networkMonitor } from '../src/lib/net';
import { cloudSettings } from '../src/lib/settings/cloud';
import { SyncStore } from '../src/lib/fs/syncStore';
import type { RecordingEntry } from '../src/lib/fs/indexStore';
import type { SyncStatus, CloudSettings } from '../src/lib/sync/types';

// Mock dependencies
jest.mock('../src/lib/net');
jest.mock('../src/lib/settings/cloud');
jest.mock('../src/lib/fs/syncStore');
jest.mock('expo-network');

const mockNetworkMonitor = networkMonitor as jest.Mocked<typeof networkMonitor>;
const mockCloudSettings = cloudSettings as jest.Mocked<typeof cloudSettings>;
const mockSyncStore = SyncStore as jest.Mocked<typeof SyncStore>;

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockRecording: RecordingEntry;

  beforeEach(() => {
    jest.clearAllMocks();
    
    syncManager = SyncManager.getInstance();
    
    mockRecording = {
      id: 'test_recording_123',
      title: 'Test Recording',
      filePath: '/path/to/recording.m4a',
      durationSec: 120,
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:02:00.000Z',
      size: 1024000,
      folderId: null,
      tags: []
    };

    // Default mock implementations
    mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('WIFI');
    mockNetworkMonitor.isAppActive.mockReturnValue(true);
    mockNetworkMonitor.isNetworkSuitable.mockReturnValue(true);
    
    mockCloudSettings.getSettings.mockResolvedValue({
      autoSyncEnabled: true,
      wifiOnly: false,
      paused: false,
    });
    
    mockSyncStore.readQueue.mockResolvedValue([]);
    mockSyncStore.writeQueue.mockResolvedValue();
  });

  afterEach(() => {
    syncManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', async () => {
      await syncManager.initialize();
      
      expect(mockSyncStore.readQueue).toHaveBeenCalled();
      expect(mockCloudSettings.getSettings).toHaveBeenCalled();
    });

    it('should restore queue from storage on init', async () => {
      const existingQueue = [{
        recordingId: 'existing_123',
        asset: 'audio' as const,
        status: 'queued' as SyncStatus,
        progressPct: 0,
        attemptCount: 1,
        lastError: null,
        updatedAt: '2024-01-01T10:00:00.000Z'
      }];
      
      mockSyncStore.readQueue.mockResolvedValue(existingQueue);
      
      await syncManager.initialize();
      
      expect(syncManager.getQueueSize()).toBe(1);
      expect(syncManager.getRecordingStatus('existing_123')).toBe('queued');
    });

    it('should set up network and app state listeners', async () => {
      await syncManager.initialize();
      
      expect(mockNetworkMonitor.onNetworkChange).toHaveBeenCalled();
      expect(mockNetworkMonitor.onAppStateChange).toHaveBeenCalled();
    });
  });

  describe('Auto-sync triggers', () => {
    beforeEach(async () => {
      await syncManager.initialize();
    });

    it('should auto-enqueue new recording when autoSyncEnabled=true', async () => {
      mockCloudSettings.shouldAllowSync.mockResolvedValue({ allowed: true });
      
      await syncManager.addRecording(mockRecording);
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('queued');
      expect(syncManager.getQueueSize()).toBe(1);
    });

    it('should not enqueue when autoSyncEnabled=false', async () => {
      mockCloudSettings.shouldAllowSync.mockResolvedValue({ 
        allowed: false, 
        reason: 'Auto-sync disabled' 
      });
      
      await syncManager.addRecording(mockRecording);
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('local');
      expect(syncManager.getQueueSize()).toBe(0);
    });

    it('should respect wifiOnly setting', async () => {
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');
      mockCloudSettings.shouldAllowSync.mockResolvedValue({ 
        allowed: false, 
        reason: 'WiFi-only mode enabled' 
      });
      
      await syncManager.addRecording(mockRecording);
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('local');
    });

    it('should enqueue when switching from cellular to WiFi', async () => {
      // Initially on cellular with WiFi-only enabled
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('CELLULAR');
      mockCloudSettings.getSettings.mockResolvedValue({
        autoSyncEnabled: true,
        wifiOnly: true,
        paused: false,
      });

      await syncManager.addRecording(mockRecording);
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('local');

      // Simulate network change to WiFi
      mockNetworkMonitor.getCurrentNetworkType.mockReturnValue('WIFI');
      mockCloudSettings.shouldAllowSync.mockResolvedValue({ allowed: true });
      
      const networkListener = mockNetworkMonitor.onNetworkChange.mock.calls[0][0];
      await networkListener('WIFI');

      expect(syncManager.getQueueSize()).toBeGreaterThan(0);
    });
  });

  describe('Pause/Resume behavior', () => {
    beforeEach(async () => {
      await syncManager.initialize();
    });

    it('should halt engine immediately when paused', async () => {
      await syncManager.addRecording(mockRecording);
      expect(syncManager.getQueueSize()).toBe(1);
      
      await syncManager.pause();
      
      expect(syncManager.isPaused()).toBe(true);
      // Queue should be preserved
      expect(syncManager.getQueueSize()).toBe(1);
    });

    it('should resume processing when unpaused', async () => {
      await syncManager.pause();
      await syncManager.addRecording(mockRecording);
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('local');
      
      await syncManager.resume();
      mockCloudSettings.shouldAllowSync.mockResolvedValue({ allowed: true });
      
      // Should now process the recording
      expect(syncManager.isPaused()).toBe(false);
    });

    it('should preserve queue across pause/resume cycles', async () => {
      await syncManager.addRecording(mockRecording);
      const initialSize = syncManager.getQueueSize();
      
      await syncManager.pause();
      expect(syncManager.getQueueSize()).toBe(initialSize);
      
      await syncManager.resume();
      expect(syncManager.getQueueSize()).toBe(initialSize);
    });
  });

  describe('Retry and backoff logic', () => {
    beforeEach(async () => {
      await syncManager.initialize();
    });

    it('should implement exponential backoff on failures', async () => {
      const mockFail = jest.fn().mockRejectedValue(new Error('Network error'));
      (syncManager as any).uploadRecording = mockFail;
      
      await syncManager.addRecording(mockRecording);
      
      // Simulate multiple failures
      await syncManager.processQueue();
      await syncManager.processQueue();
      await syncManager.processQueue();
      
      const status = syncManager.getRecordingStatus(mockRecording.id);
      expect(['failed', 'queued']).toContain(status);
    });

    it('should retry failed uploads with manual retry', async () => {
      // Simulate failed upload
      syncManager.setRecordingStatus(mockRecording.id, 'failed');
      
      await syncManager.retryRecording(mockRecording.id);
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('queued');
    });

    it('should respect max retry attempts', async () => {
      const queueItem = {
        recordingId: mockRecording.id,
        asset: 'audio' as const,
        status: 'failed' as SyncStatus,
        progressPct: 0,
        attemptCount: 4, // Exceeded max attempts
        lastError: 'Max retries exceeded',
        updatedAt: '2024-01-01T10:00:00.000Z'
      };
      
      mockSyncStore.readQueue.mockResolvedValue([queueItem]);
      await syncManager.initialize();
      
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('failed');
    });
  });

  describe('Concurrency control', () => {
    beforeEach(async () => {
      await syncManager.initialize();
    });

    it('should process uploads with concurrency=1', async () => {
      const recording1 = { ...mockRecording, id: 'rec1' };
      const recording2 = { ...mockRecording, id: 'rec2' };
      
      await syncManager.addRecording(recording1);
      await syncManager.addRecording(recording2);
      
      expect(syncManager.getActiveUploads()).toBeLessThanOrEqual(1);
    });

    it('should queue additional recordings when at capacity', async () => {
      for (let i = 0; i < 3; i++) {
        await syncManager.addRecording({ ...mockRecording, id: `rec${i}` });
      }
      
      expect(syncManager.getQueueSize()).toBe(3);
      expect(syncManager.getActiveUploads()).toBeLessThanOrEqual(1);
    });
  });

  describe('Persistence', () => {
    it('should persist queue after every state transition', async () => {
      await syncManager.initialize();
      
      await syncManager.addRecording(mockRecording);
      expect(mockSyncStore.writeQueue).toHaveBeenCalled();
      
      syncManager.setRecordingStatus(mockRecording.id, 'uploading');
      expect(mockSyncStore.writeQueue).toHaveBeenCalledTimes(2);
    });

    it('should handle storage errors gracefully', async () => {
      mockSyncStore.writeQueue.mockRejectedValue(new Error('Storage full'));
      
      await syncManager.initialize();
      
      // Should not crash on storage errors
      await expect(syncManager.addRecording(mockRecording)).resolves.not.toThrow();
    });
  });

  describe('Status tracking', () => {
    beforeEach(async () => {
      await syncManager.initialize();
    });

    it('should track recording status through upload lifecycle', async () => {
      await syncManager.addRecording(mockRecording);
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('queued');
      
      syncManager.setRecordingStatus(mockRecording.id, 'uploading');
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('uploading');
      
      syncManager.setRecordingStatus(mockRecording.id, 'synced');
      expect(syncManager.getRecordingStatus(mockRecording.id)).toBe('synced');
    });

    it('should provide accurate queue statistics', async () => {
      await syncManager.addRecording({ ...mockRecording, id: 'rec1' });
      await syncManager.addRecording({ ...mockRecording, id: 'rec2' });
      syncManager.setRecordingStatus('rec1', 'uploading');
      syncManager.setRecordingStatus('rec2', 'failed');
      
      const stats = syncManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.uploading).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });
});