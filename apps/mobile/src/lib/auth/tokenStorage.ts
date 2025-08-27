import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const USER_ID_KEY = 'auth.userId';
const DEVICE_ID_KEY = 'auth.deviceId';
const USER_EMAIL_KEY = 'auth.userEmail';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  deviceId: string;
  userEmail?: string;
}

/**
 * Secure token storage using Expo SecureStore
 * Handles encrypted storage of authentication tokens
 */
export class TokenStorage {
  
  /**
   * Store authentication tokens securely
   */
  static async storeTokens(tokens: StoredTokens): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
        SecureStore.setItemAsync(USER_ID_KEY, tokens.userId),
        SecureStore.setItemAsync(DEVICE_ID_KEY, tokens.deviceId),
        tokens.userEmail 
          ? SecureStore.setItemAsync(USER_EMAIL_KEY, tokens.userEmail)
          : SecureStore.deleteItemAsync(USER_EMAIL_KEY).catch(() => {}) // Ignore errors for optional field
      ]);
      console.log('AUTH_STORAGE: Tokens stored securely');
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve stored authentication tokens
   */
  static async getTokens(): Promise<StoredTokens | null> {
    try {
      const [accessToken, refreshToken, userId, deviceId, userEmail] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_ID_KEY),
        SecureStore.getItemAsync(DEVICE_ID_KEY),
        SecureStore.getItemAsync(USER_EMAIL_KEY)
      ]);

      if (!accessToken || !refreshToken || !userId || !deviceId) {
        console.log('AUTH_STORAGE: Incomplete token data found');
        return null;
      }

      const tokens: StoredTokens = {
        accessToken,
        refreshToken,
        userId,
        deviceId,
        ...(userEmail && { userEmail })
      };

      console.log('AUTH_STORAGE: Tokens retrieved successfully');
      return tokens;
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Update just the access token (for refresh operations)
   */
  static async updateAccessToken(newAccessToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccessToken);
      console.log('AUTH_STORAGE: Access token updated');
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to update access token:', error);
      throw new Error('Failed to update access token');
    }
  }

  /**
   * Update user email after email verification
   */
  static async updateUserEmail(email: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_EMAIL_KEY, email);
      console.log('AUTH_STORAGE: User email updated');
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to update user email:', error);
      throw new Error('Failed to update user email');
    }
  }

  /**
   * Clear all stored authentication data
   */
  static async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_ID_KEY),
        SecureStore.deleteItemAsync(DEVICE_ID_KEY),
        SecureStore.deleteItemAsync(USER_EMAIL_KEY)
      ].map(p => p.catch(() => {}))); // Ignore errors for missing keys
      
      console.log('AUTH_STORAGE: All tokens cleared');
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to clear tokens:', error);
      throw new Error('Failed to clear authentication tokens');
    }
  }

  /**
   * Check if we have stored tokens (basic availability check)
   */
  static async hasTokens(): Promise<boolean> {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      return !!(accessToken && refreshToken);
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to check token availability:', error);
      return false;
    }
  }

  /**
   * Get just the access token for API requests
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Get just the refresh token for token refresh operations
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Get the device ID
   */
  static async getDeviceId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(DEVICE_ID_KEY);
    } catch (error) {
      console.error('AUTH_STORAGE: Failed to get device ID:', error);
      return null;
    }
  }
}