import { uploadRecording, validateUpload } from '../src/lib/upload';
import { storageClient } from '../src/lib/api/storage';
import * as FileSystem from 'expo-file-system';
import type { RecordingEntry } from '../src/lib/fs/indexStore';

// Mock dependencies
jest.mock('../src/lib/api/storage');
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  uploadAsync: jest.fn(),
  FileSystemUploadType: {
    BINARY_CONTENT: 'BINARY_CONTENT'
  }
}));

const mockStorageClient = storageClient as jest.Mocked<typeof storageClient>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('Upload Flow', () => {
  const mockRecording: RecordingEntry = {
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      size: 1024000,
      isDirectory: false,
      uri: '/path/to/recording.m4a'
    } as any);

    mockStorageClient.getPresignedUrl.mockResolvedValue({
      url: 'https://presigned-url.com',
      method: 'PUT',
      headers: { 'Content-Type': 'audio/m4a' },
      key: 'recordings/test_recording_123.m4a',
      expiresSec: 900
    });

    mockStorageClient.finalizeUpload.mockResolvedValue({
      id: 'test_recording_123'
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 200,
      headers: {}
    } as any);
  });

  describe('validateUpload()', () => {
    it('should validate a valid recording', async () => {
      const result = await validateUpload(mockRecording);

      expect(result).toEqual({ valid: true });
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith('/path/to/recording.m4a');
    });

    it('should reject non-existent file', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false
      } as any);

      const result = await validateUpload(mockRecording);

      expect(result).toEqual({
        valid: false,
        reason: 'File not found'
      });
    });

    it('should reject oversized files', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 101 * 1024 * 1024, // 101MB
        isDirectory: false,
        uri: '/path/to/recording.m4a'
      } as any);

      const result = await validateUpload(mockRecording);

      expect(result).toEqual({
        valid: false,
        reason: 'File too large (max 100MB)'
      });
    });

    it('should reject non-m4a files', async () => {
      const mp3Recording = {
        ...mockRecording,
        filePath: '/path/to/recording.mp3'
      };

      const result = await validateUpload(mp3Recording);

      expect(result).toEqual({
        valid: false,
        reason: 'Only .m4a files are supported'
      });
    });

    it('should handle validation errors gracefully', async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error('File system error'));

      const result = await validateUpload(mockRecording);

      expect(result).toEqual({
        valid: false,
        reason: 'Validation failed'
      });
    });
  });

  describe('uploadRecording()', () => {
    it('should complete full upload flow successfully', async () => {
      const progressUpdates: any[] = [];
      const onProgress = jest.fn((progress) => progressUpdates.push(progress));

      const result = await uploadRecording(mockRecording, onProgress);

      expect(result).toBe('recordings/test_recording_123.m4a');

      // Verify all steps were called in correct order
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith('/path/to/recording.m4a');
      expect(mockStorageClient.getPresignedUrl).toHaveBeenCalledWith({
        id: 'test_recording_123',
        contentType: 'audio/m4a',
        sizeBytes: 1024000
      });
      expect(mockFileSystem.uploadAsync).toHaveBeenCalledWith(
        'https://presigned-url.com',
        '/path/to/recording.m4a',
        {
          httpMethod: 'PUT',
          headers: { 'Content-Type': 'audio/m4a' },
          uploadType: 'BINARY_CONTENT'
        }
      );
      expect(mockStorageClient.finalizeUpload).toHaveBeenCalledWith({
        id: 'test_recording_123',
        key: 'recordings/test_recording_123.m4a',
        title: 'Test Recording',
        durationSec: 120,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:02:00.000Z'
      });

      // Verify progress updates
      expect(progressUpdates).toHaveLength(4);
      expect(progressUpdates[0]).toMatchObject({
        phase: 'presigning',
        progress: 10,
        message: 'Preparing upload...'
      });
      expect(progressUpdates[1]).toMatchObject({
        phase: 'uploading',
        progress: 20,
        message: 'Uploading to cloud...'
      });
      expect(progressUpdates[2]).toMatchObject({
        phase: 'finalizing',
        progress: 80,
        message: 'Finalizing upload...'
      });
      expect(progressUpdates[3]).toMatchObject({
        phase: 'completed',
        progress: 100,
        message: 'Upload completed successfully!'
      });
    });

    it('should handle file not found error', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false
      } as any);

      const onProgress = jest.fn();

      await expect(uploadRecording(mockRecording, onProgress))
        .rejects.toThrow('Recording file not found');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'error',
          message: 'Recording file not found',
          error: 'Recording file not found'
        })
      );
    });

    it('should handle presign request failure', async () => {
      mockStorageClient.getPresignedUrl.mockRejectedValue(
        new Error('Presign failed')
      );

      const onProgress = jest.fn();

      await expect(uploadRecording(mockRecording, onProgress))
        .rejects.toThrow('Presign failed');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'error',
          message: 'Presign failed',
          error: 'Presign failed'
        })
      );
    });

    it('should handle upload failure', async () => {
      mockFileSystem.uploadAsync.mockResolvedValue({
        status: 403,
        headers: {}
      } as any);

      const onProgress = jest.fn();

      await expect(uploadRecording(mockRecording, onProgress))
        .rejects.toThrow('Upload failed with status: 403');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'error',
          message: 'Upload failed with status: 403'
        })
      );
    });

    it('should handle finalize failure', async () => {
      mockStorageClient.finalizeUpload.mockRejectedValue(
        new Error('Finalize failed')
      );

      const onProgress = jest.fn();

      await expect(uploadRecording(mockRecording, onProgress))
        .rejects.toThrow('Finalize failed');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'error',
          message: 'Finalize failed'
        })
      );
    });

    it('should work without progress callback', async () => {
      const result = await uploadRecording(mockRecording);

      expect(result).toBe('recordings/test_recording_123.m4a');
      // Should not crash when no callback provided
    });

    it('should handle network timeouts gracefully', async () => {
      mockFileSystem.uploadAsync.mockRejectedValue(
        new Error('Network timeout')
      );

      const onProgress = jest.fn();

      await expect(uploadRecording(mockRecording, onProgress))
        .rejects.toThrow('Network timeout');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'error',
          error: 'Network timeout'
        })
      );
    });

    it('should provide correct recording ID in progress updates', async () => {
      const onProgress = jest.fn();

      await uploadRecording(mockRecording, onProgress);

      // All progress updates should have the correct recording ID
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test_recording_123'
        })
      );
    });

    it('should handle missing file size gracefully', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: undefined, // No size property
        isDirectory: false,
        uri: '/path/to/recording.m4a'
      } as any);

      const result = await uploadRecording(mockRecording);

      expect(result).toBe('recordings/test_recording_123.m4a');
      expect(mockStorageClient.getPresignedUrl).toHaveBeenCalledWith({
        id: 'test_recording_123',
        contentType: 'audio/m4a',
        sizeBytes: 0 // Should default to 0
      });
    });

    it('should pass updatedAt if provided', async () => {
      const recordingWithUpdated = {
        ...mockRecording,
        updatedAt: '2024-01-01T10:05:00.000Z'
      };

      await uploadRecording(recordingWithUpdated);

      expect(mockStorageClient.finalizeUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: '2024-01-01T10:05:00.000Z'
        })
      );
    });

    it('should handle missing updatedAt field', async () => {
      const recordingWithoutUpdated = {
        ...mockRecording,
        updatedAt: undefined
      } as any;

      await uploadRecording(recordingWithoutUpdated);

      expect(mockStorageClient.finalizeUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: undefined
        })
      );
    });
  });
});