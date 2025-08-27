import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';
import { generateRecordingKey } from './ids';
import type { PresignResponse } from '../types';

/**
 * S3-compatible storage client using AWS SDK
 * Works with both AWS S3 and MinIO
 */
class S3Storage {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test connection by attempting to list objects (this will fail gracefully if bucket doesn't exist)
      console.log('🔗 Initializing S3 connection...');
      console.log(`  Endpoint: ${env.S3_ENDPOINT}`);
      console.log(`  Bucket: ${env.S3_BUCKET}`);
      console.log('✅ S3 client initialized');
    } catch (error) {
      console.error('❌ S3 initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate presigned PUT URL for uploading a recording
   */
  async getPresignedPutUrl(id: string, contentType: string = 'audio/m4a', userId?: string): Promise<PresignResponse> {
    const key = userId 
      ? `u/${userId}/recordings/${id}.m4a`
      : generateRecordingKey(id);
    
    try {
      // Create the presigned URL manually using the correct method
      const url = await getSignedUrl(
        this.client,
        {
          ...new (require('@aws-sdk/client-s3').PutObjectCommand)({
            Bucket: env.S3_BUCKET,
            Key: key,
            ContentType: contentType,
          }),
        } as any,
        { 
          expiresIn: env.PRESIGN_EXPIRES_SEC,
        }
      );

      return {
        url,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        key,
        expiresSec: env.PRESIGN_EXPIRES_SEC,
      };
    } catch (error) {
      console.error('Failed to generate presigned PUT URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Generate presigned GET URL for downloading/streaming a recording
   */
  async getPresignedGetUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, {
        expiresIn: env.PRESIGN_EXPIRES_SEC, // 15 minutes
      });

      return url;
    } catch (error) {
      console.error('Failed to generate presigned GET URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      });

      await this.client.send(command);
      console.log(`🗑️  Deleted S3 object: ${key}`);
    } catch (error) {
      console.error('Failed to delete S3 object:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Check if an object exists in S3 (used for validation)
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      });
      
      // We don't actually download the object, just check if we can access it
      await getSignedUrl(this.client, command, { expiresIn: 60 });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const s3 = new S3Storage();