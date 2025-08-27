import { apiClient, ApiError } from '../src/lib/api/client';
import { setCloudConfig } from '../src/lib/config';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock the config module
jest.mock('../src/lib/config', () => ({
  getApiBaseUrl: jest.fn(),
  setCloudConfig: jest.fn(),
  isCloudAvailable: jest.fn(),
  testCloudConnection: jest.fn(),
}));

const mockGetApiBaseUrl = require('../src/lib/config').getApiBaseUrl;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockGetApiBaseUrl.mockResolvedValue('http://localhost:4000');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ping()', () => {
    it('should successfully ping the health endpoint', async () => {
      const mockResponse = {
        ok: true,
        storage: 's3',
        timestamp: '2024-01-01T12:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await apiClient.ping();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/health/ping',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Danger-Dev-Server': 'true'
          })
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.ping()).rejects.toThrow(ApiError);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal Server Error',
          message: 'Server is down',
          statusCode: 500
        })
      });

      await expect(apiClient.ping()).rejects.toThrow('Server is down');
    });
  });

  describe('listRecordings()', () => {
    it('should fetch and return recordings list', async () => {
      const mockRecordings = [
        {
          id: 'rec_1',
          title: 'Test Recording 1',
          durationSec: 30,
          createdAt: '2024-01-01T10:00:00.000Z',
          fileUrl: 'https://signed-url-1.com'
        },
        {
          id: 'rec_2', 
          title: 'Test Recording 2',
          durationSec: 60,
          createdAt: '2024-01-01T11:00:00.000Z',
          fileUrl: 'https://signed-url-2.com'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRecordings
      });

      const result = await apiClient.listRecordings();

      expect(result).toEqual(mockRecordings);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/recordings',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Danger-Dev-Server': 'true'
          })
        })
      );
    });

    it('should return empty array when no recordings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => []
      });

      const result = await apiClient.listRecordings();

      expect(result).toEqual([]);
    });

    it('should handle list recordings error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'Access denied',
          statusCode: 403
        })
      });

      const error = await apiClient.listRecordings().catch(e => e);
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });
  });

  describe('deleteRecording()', () => {
    it('should successfully delete a recording', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204
      });

      await expect(apiClient.deleteRecording('rec_123')).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/recordings/rec_123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'X-Danger-Dev-Server': 'true'
          })
        })
      );
    });

    it('should handle 404 when recording not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        })
      });

      const error = await apiClient.deleteRecording('nonexistent').catch(e => e);
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.isClientError).toBe(true);
    });
  });

  describe('getStreamUrl()', () => {
    it('should generate correct stream URL', async () => {
      const result = await apiClient.getStreamUrl('rec_stream_123');

      expect(result).toBe('http://localhost:4000/v1/recordings/rec_stream_123/stream');
    });

    it('should handle error when base URL unavailable', async () => {
      mockGetApiBaseUrl.mockRejectedValueOnce(new Error('No base URL configured'));

      await expect(apiClient.getStreamUrl('rec_123')).rejects.toThrow('No base URL configured');
    });
  });

  describe('Error Handling', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 400, {
        error: 'Bad Request',
        message: 'Test error',
        statusCode: 400
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isClientError).toBe(true);
      expect(error.isServerError).toBe(false);
      expect(error.isNetworkError).toBe(false);
    });

    it('should identify network errors', () => {
      const error = new ApiError('Network failed', 0, {
        error: 'NetworkError',
        message: 'Network failed',
        statusCode: 0
      });

      expect(error.isNetworkError).toBe(true);
      expect(error.isClientError).toBe(false);
      expect(error.isServerError).toBe(false);
    });

    it('should identify server errors', () => {
      const error = new ApiError('Server error', 500, {
        error: 'Internal Server Error',
        message: 'Server error',
        statusCode: 500
      });

      expect(error.isServerError).toBe(true);
      expect(error.isClientError).toBe(false);
      expect(error.isNetworkError).toBe(false);
    });

    it('should handle malformed error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const error = await apiClient.ping().catch(e => e);
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Request failed with status 500');
      expect(error.statusCode).toBe(500);
    });

    it('should handle timeout scenarios', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const error = await apiClient.ping().catch(e => e);
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error.isNetworkError).toBe(true);
    });
  });

  describe('Request Configuration', () => {
    it('should set correct headers for all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      });

      await apiClient.ping();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Danger-Dev-Server': 'true'
          })
        })
      );
    });

    it('should handle base URL retrieval failure', async () => {
      mockGetApiBaseUrl.mockRejectedValueOnce(new Error('Cloud not configured'));

      await expect(apiClient.ping()).rejects.toThrow('Cloud not configured');
    });
  });
});