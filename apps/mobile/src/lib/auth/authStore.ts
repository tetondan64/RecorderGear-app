import { create } from 'zustand';
import { TokenStorage, type StoredTokens } from './tokenStorage';

export interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  deviceId: string | null;
  userEmail: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  registerDevice: (userAgent?: string) => Promise<void>;
  requestEmailOtp: (email: string) => Promise<{ otp?: string }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Internal state management
  setTokens: (tokens: StoredTokens) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

/**
 * Authentication store using Zustand
 * Manages auth state and provides auth operations
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: false,
  userId: null,
  deviceId: null,
  userEmail: null,

  /**
   * Initialize auth state by checking for stored tokens
   * Should be called during app startup
   */
  initialize: async () => {
    set({ isLoading: true });
    
    try {
      console.log('AUTH_STORE: Initializing auth state...');
      
      const tokens = await TokenStorage.getTokens();
      if (tokens) {
        console.log('AUTH_STORE: Found stored tokens, user authenticated');
        set({
          isAuthenticated: true,
          userId: tokens.userId,
          deviceId: tokens.deviceId,
          userEmail: tokens.userEmail || null,
          isLoading: false
        });
      } else {
        console.log('AUTH_STORE: No stored tokens, starting device registration...');
        // No tokens found, register device automatically
        await get().registerDevice();
      }
    } catch (error) {
      console.error('AUTH_STORE: Failed to initialize:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Register device anonymously and get initial tokens
   * Automatically called if no tokens are found on initialization
   */
  registerDevice: async (userAgent?: string) => {
    set({ isLoading: true });
    
    try {
      console.log('AUTH_STORE: Registering device...');
      
      // Import API client here to avoid circular dependencies
      const { apiClient } = await import('../api/client');
      
      const response = await apiClient.post('/v1/auth/device/register', {
        userAgent: userAgent || 'RecorderGear Mobile'
      });

      const tokens: StoredTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        userId: response.data.userId,
        deviceId: response.data.deviceId
      };

      await TokenStorage.storeTokens(tokens);
      
      set({
        isAuthenticated: true,
        userId: response.data.userId,
        deviceId: response.data.deviceId,
        userEmail: null, // Anonymous user has no email yet
        isLoading: false
      });

      console.log('AUTH_STORE: Device registered successfully');
    } catch (error) {
      console.error('AUTH_STORE: Device registration failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Request email OTP for email upgrade
   */
  requestEmailOtp: async (email: string) => {
    const { deviceId } = get();
    if (!deviceId) {
      throw new Error('No device ID available');
    }

    try {
      console.log('AUTH_STORE: Requesting email OTP...');
      
      const { apiClient } = await import('../api/client');
      
      const response = await apiClient.post('/v1/auth/email/request', {
        email,
        deviceId
      });

      console.log('AUTH_STORE: Email OTP requested successfully');
      
      // Return OTP for dev mode (if included in response)
      return {
        otp: response.data.otp
      };
    } catch (error) {
      console.error('AUTH_STORE: Email OTP request failed:', error);
      throw error;
    }
  },

  /**
   * Verify email OTP and upgrade account
   */
  verifyEmailOtp: async (email: string, otp: string) => {
    const { deviceId } = get();
    if (!deviceId) {
      throw new Error('No device ID available');
    }

    try {
      console.log('AUTH_STORE: Verifying email OTP...');
      
      const { apiClient } = await import('../api/client');
      
      const response = await apiClient.post('/v1/auth/email/verify', {
        email,
        deviceId,
        otp
      });

      // Update stored tokens with new ones (old tokens are revoked)
      const newTokens: StoredTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        userId: response.data.userId,
        deviceId,
        userEmail: response.data.email
      };

      await TokenStorage.storeTokens(newTokens);
      
      set({
        userEmail: response.data.email,
        isAuthenticated: true
      });

      console.log('AUTH_STORE: Email verified and account upgraded');
    } catch (error) {
      console.error('AUTH_STORE: Email verification failed:', error);
      throw error;
    }
  },

  /**
   * Refresh access token using stored refresh token
   */
  refreshTokens: async () => {
    try {
      console.log('AUTH_STORE: Refreshing tokens...');
      
      const refreshToken = await TokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const { apiClient } = await import('../api/client');
      
      const response = await apiClient.post('/v1/auth/token/refresh', {
        refreshToken
      });

      await TokenStorage.updateAccessToken(response.data.accessToken);
      
      console.log('AUTH_STORE: Tokens refreshed successfully');
    } catch (error) {
      console.error('AUTH_STORE: Token refresh failed:', error);
      // If refresh fails, clear auth state and force re-registration
      await get().logout();
      throw error;
    }
  },

  /**
   * Logout and clear all auth state
   */
  logout: async () => {
    try {
      console.log('AUTH_STORE: Logging out...');
      
      await TokenStorage.clearTokens();
      
      set({
        isAuthenticated: false,
        userId: null,
        deviceId: null,
        userEmail: null,
        isLoading: false
      });

      console.log('AUTH_STORE: Logged out successfully');
      
      // Auto-register new device after logout
      await get().registerDevice();
    } catch (error) {
      console.error('AUTH_STORE: Logout failed:', error);
      throw error;
    }
  },

  /**
   * Internal: Set tokens in state (used by auth operations)
   */
  setTokens: (tokens: StoredTokens) => {
    set({
      isAuthenticated: true,
      userId: tokens.userId,
      deviceId: tokens.deviceId,
      userEmail: tokens.userEmail || null
    });
  },

  /**
   * Internal: Set loading state
   */
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  /**
   * Internal: Clear auth state without storage operations
   */
  clearAuth: () => {
    set({
      isAuthenticated: false,
      userId: null,
      deviceId: null,
      userEmail: null,
      isLoading: false
    });
  }
}));

/**
 * Helper hook to check if user has upgraded to email account
 */
export const useIsEmailUser = () => {
  const userEmail = useAuthStore(state => state.userEmail);
  return !!userEmail;
};

/**
 * Helper hook to get auth status for UI components
 */
export const useAuthStatus = () => {
  return useAuthStore(state => ({
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    hasEmail: !!state.userEmail
  }));
};