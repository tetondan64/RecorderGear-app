import { TokenStorage } from '../auth/tokenStorage';

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * HTTP client with automatic token refresh and auth handling
 * Wraps fetch with authentication and retry logic
 */
export class AuthenticatedApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Main request method with automatic auth and refresh handling
   */
  async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      skipAuth = false
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    
    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Danger-Dev-Server': 'true', // Required for dev server
      ...headers
    };

    // Add auth header if not skipping auth
    if (!skipAuth) {
      const accessToken = await TokenStorage.getAccessToken();
      if (accessToken) {
        requestHeaders.Authorization = `Bearer ${accessToken}`;
      }
    }

    // Prepare request
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      ...(body && { body: JSON.stringify(body) })
    };

    console.log(`API_CLIENT: ${method} ${endpoint}`);

    try {
      // Make the request
      const response = await fetch(url, requestOptions);
      
      // Handle 401 - token expired, attempt refresh
      if (response.status === 401 && !skipAuth) {
        console.log('API_CLIENT: 401 response, attempting token refresh...');
        
        // Prevent multiple concurrent refresh attempts
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          this.refreshPromise = this.refreshAccessToken();
        }
        
        // Wait for refresh to complete
        if (this.refreshPromise) {
          await this.refreshPromise;
        }
        
        // Retry the original request with new token
        const newAccessToken = await TokenStorage.getAccessToken();
        if (newAccessToken) {
          requestHeaders.Authorization = `Bearer ${newAccessToken}`;
          const retryOptions = { ...requestOptions, headers: requestHeaders };
          
          console.log('API_CLIENT: Retrying request with refreshed token...');
          const retryResponse = await fetch(url, retryOptions);
          return await this.handleResponse<T>(retryResponse);
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error('API_CLIENT: Request failed:', error);
      throw new Error('Network request failed');
    }
  }

  /**
   * Convenience methods for common HTTP operations
   */
  async get<T = any>(endpoint: string, options: Omit<Parameters<typeof this.request>[1], 'method'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<Parameters<typeof this.request>[1], 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<Parameters<typeof this.request>[1], 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T = any>(endpoint: string, options: Omit<Parameters<typeof this.request>[1], 'method'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Handle response parsing and error checking
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      // API error response
      const apiError: ApiError = isJson ? data : {
        error: response.statusText,
        message: `HTTP ${response.status}`,
        statusCode: response.status
      };
      
      console.error('API_CLIENT: API error:', apiError);
      const error = new Error(apiError.message) as any;
      error.apiError = apiError;
      error.status = response.status;
      throw error;
    }

    return {
      data: data as T,
      status: response.status,
      statusText: response.statusText
    };
  }

  /**
   * Refresh access token using stored refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('API_CLIENT: Attempting to refresh access token...');
      
      const refreshToken = await TokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.request('/v1/auth/token/refresh', {
        method: 'POST',
        body: { refreshToken },
        skipAuth: true // Don't use auth for refresh endpoint
      });

      await TokenStorage.updateAccessToken(response.data.accessToken);
      console.log('API_CLIENT: Access token refreshed successfully');
    } catch (error) {
      console.error('API_CLIENT: Token refresh failed:', error);
      
      // Clear tokens and force logout if refresh fails
      await TokenStorage.clearTokens();
      throw new Error('Authentication expired. Please sign in again.');
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }
}

// Export singleton instance
export const createApiClient = (baseUrl: string) => new AuthenticatedApiClient(baseUrl);