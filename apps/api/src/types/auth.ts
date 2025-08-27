// Auth API Types

export interface DeviceRegisterRequest {
  userAgent?: string;
}

export interface DeviceRegisterResponse {
  userId: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  accessExpiresInSec: number;
}

export interface EmailOtpRequest {
  email: string;
  deviceId: string;
}

export interface EmailOtpResponse {
  message: string;
  expiresInSec: number;
  otp?: string; // Only included in development mode
}

export interface EmailVerifyRequest {
  email: string;
  deviceId: string;
  otp: string;
}

export interface EmailVerifyResponse {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}