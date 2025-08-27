import { getApiBaseUrl } from '../config';
import { ApiError } from './client';

/**
 * Cloud storage operations: presigned URLs and finalization
 */

export interface PresignRequest {
  id: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignResponse {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  key: string;
  expiresSec: number;
}

export interface FinalizeRequest {
  id: string;
  key: string;
  title: string;
  durationSec: number;
  createdAt: string;
  updatedAt?: string;
}

export interface FinalizeResponse {
  id: string;
}

class StorageClient {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const baseUrl = await getApiBaseUrl();
      const url = `${baseUrl}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Danger-Dev-Server': 'true',
          ...options.headers,
        },
        timeout: 10000,
      } as any);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: 'HTTP Error',
            message: `Request failed with status ${response.status}`,
            statusCode: response.status,
          };
        }
        throw new ApiError(errorData.message, response.status, errorData);
      }

      return await response.json();
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error('STORAGE_CLIENT: Request failed:', error);
      throw new ApiError(
        error.message || 'Network request failed',
        0,
        { error: 'NetworkError', message: error.message, statusCode: 0 }
      );
    }
  }

  /**
   * Get presigned PUT URL for uploading
   */
  async getPresignedUrl(request: PresignRequest): Promise<PresignResponse> {
    console.log('STORAGE_CLIENT: Requesting presigned URL for:', request.id);
    
    const response = await this.makeRequest<PresignResponse>('/v1/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    console.log('STORAGE_CLIENT: Presigned URL obtained:', {
      key: response.key,
      expiresIn: response.expiresSec,
    });

    return response;
  }

  /**
   * Finalize upload after successful PUT
   */
  async finalizeUpload(request: FinalizeRequest): Promise<FinalizeResponse> {
    console.log('STORAGE_CLIENT: Finalizing upload for:', request.id);

    const response = await this.makeRequest<FinalizeResponse>('/v1/recordings/finalize', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    console.log('STORAGE_CLIENT: Upload finalized:', response.id);
    return response;
  }
}

// Export singleton instance
export const storageClient = new StorageClient();