import { getApiBaseUrl } from '../config';

/**
 * API client for RecorderGear cloud storage
 * Handles authentication, error handling, and request formatting
 */

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface RecordingResponse {
  id: string;
  title: string;
  durationSec: number;
  createdAt: string;
  fileUrl: string;
}

export interface HealthResponse {
  ok: boolean;
  storage: string;
  timestamp?: string;
}

class ApiClient {
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
          'X-Danger-Dev-Server': 'true', // Required for dev server
          ...options.headers,
        },
        timeout: 10000, // 10 second timeout
      } as any);

      if (!response.ok) {
        let errorData: ApiError;
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

      // Handle 204 No Content responses
      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      console.error('API_CLIENT: Request failed:', error);
      throw new ApiError(
        error.message || 'Network request failed',
        0,
        { error: 'NetworkError', message: error.message, statusCode: 0 }
      );
    }
  }

  /**
   * Test API connection
   */
  async ping(): Promise<HealthResponse> {
    return this.makeRequest<HealthResponse>('/v1/health/ping');
  }

  /**
   * List all cloud recordings
   */
  async listRecordings(): Promise<RecordingResponse[]> {
    return this.makeRequest<RecordingResponse[]>('/v1/recordings');
  }

  /**
   * Delete a cloud recording
   */
  async deleteRecording(id: string): Promise<void> {
    await this.makeRequest(`/v1/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get stream URL for a recording (optional proxy endpoint)
   */
  async getStreamUrl(id: string): Promise<string> {
    try {
      const baseUrl = await getApiBaseUrl();
      return `${baseUrl}/v1/recordings/${id}/stream`;
    } catch (error) {
      console.error('API_CLIENT: Failed to generate stream URL:', error);
      throw error;
    }
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorData: ApiError
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export { ApiError };