import * as FileSystem from 'expo-file-system';
import { storageClient, PresignRequest } from './api/storage';
import type { RecordingEntry } from './fs/indexStore';

/**
 * Cloud upload functionality
 * Handles the complete flow: presign → PUT upload → finalize
 */

export interface UploadProgress {
  id: string;
  phase: 'presigning' | 'uploading' | 'finalizing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Upload a recording to cloud storage
 */
export async function uploadRecording(
  recording: RecordingEntry,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const updateProgress = (update: Partial<UploadProgress>) => {
    if (onProgress) {
      onProgress({
        id: recording.id,
        phase: 'presigning',
        progress: 0,
        message: 'Starting upload...',
        ...update,
      });
    }
  };

  try {
    // Phase 1: Get file info and request presigned URL
    updateProgress({ phase: 'presigning', progress: 10, message: 'Preparing upload...' });

    const fileInfo = await FileSystem.getInfoAsync(recording.filePath);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    const presignRequest: PresignRequest = {
      id: recording.id,
      contentType: 'audio/m4a',
      sizeBytes: fileInfo.size || 0,
    };

    console.log('UPLOAD: Getting presigned URL for:', recording.id);
    const presignData = await storageClient.getPresignedUrl(presignRequest);
    
    updateProgress({ phase: 'uploading', progress: 20, message: 'Uploading to cloud...' });

    // Phase 2: Upload file to presigned URL
    console.log('UPLOAD: Starting PUT upload to:', presignData.url);
    
    const uploadResponse = await FileSystem.uploadAsync(presignData.url, recording.filePath, {
      httpMethod: 'PUT',
      headers: presignData.headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (uploadResponse.status !== 200) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    updateProgress({ phase: 'finalizing', progress: 80, message: 'Finalizing upload...' });

    // Phase 3: Finalize upload with metadata
    console.log('UPLOAD: Finalizing upload for:', recording.id);
    
    await storageClient.finalizeUpload({
      id: recording.id,
      key: presignData.key,
      title: recording.title,
      durationSec: recording.durationSec,
      createdAt: recording.createdAt,
      updatedAt: recording.updatedAt,
    });

    updateProgress({ 
      phase: 'completed', 
      progress: 100, 
      message: 'Upload completed successfully!' 
    });

    console.log('UPLOAD: Successfully uploaded:', recording.id);
    return presignData.key;

  } catch (error: any) {
    const errorMessage = error.message || 'Upload failed';
    console.error('UPLOAD: Failed to upload recording:', error);
    
    updateProgress({
      phase: 'error',
      progress: 0,
      message: errorMessage,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Check if a file can be uploaded (size limits, format, etc.)
 */
export async function validateUpload(recording: RecordingEntry): Promise<{
  valid: boolean;
  reason?: string;
}> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(recording.filePath);
    
    if (!fileInfo.exists) {
      return { valid: false, reason: 'File not found' };
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (fileInfo.size && fileInfo.size > maxSize) {
      return { valid: false, reason: 'File too large (max 100MB)' };
    }

    // Check file format (should be .m4a)
    if (!recording.filePath.endsWith('.m4a')) {
      return { valid: false, reason: 'Only .m4a files are supported' };
    }

    return { valid: true };
  } catch (error) {
    console.error('UPLOAD: Validation failed:', error);
    return { valid: false, reason: 'Validation failed' };
  }
}

/**
 * Generate a unique upload ID (in case we need it different from recording ID)
 */
export function generateUploadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}`;
}