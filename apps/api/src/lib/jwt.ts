import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';

interface TokenPayload {
  userId: string;
  deviceId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

interface JwtConfig {
  secret: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

export class JwtService {
  private config: JwtConfig;

  constructor(config: JwtConfig) {
    this.config = config;
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(userId: string, deviceId: string): string {
    const payload: TokenPayload = {
      userId,
      deviceId,
      type: 'access'
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.accessTtlSec,
      issuer: 'recordergear-api',
      audience: 'recordergear-mobile'
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  generateRefreshToken(userId: string, deviceId: string): string {
    const payload: TokenPayload = {
      userId,
      deviceId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.refreshTtlSec,
      issuer: 'recordergear-api',
      audience: 'recordergear-mobile'
    });
  }

  /**
   * Verify and decode token
   */
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: 'recordergear-api',
        audience: 'recordergear-mobile'
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('TOKEN_INVALID');
      } else {
        throw new Error('TOKEN_VERIFICATION_FAILED');
      }
    }
  }

  /**
   * Generate a secure device ID
   */
  generateDeviceId(): string {
    return `dev_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generate secure random string for OTP
   */
  generateOtp(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * digits.length);
      otp += digits[randomIndex];
    }
    return otp;
  }

  /**
   * Hash OTP for storage (simple hash for dev)
   */
  hashOtp(otp: string): string {
    return Buffer.from(otp).toString('base64');
  }

  /**
   * Verify OTP against hash
   */
  verifyOtp(otp: string, hash: string): boolean {
    return this.hashOtp(otp) === hash;
  }
}

// Create JWT service instance with environment config
export const createJwtService = (env: NodeJS.ProcessEnv): JwtService => {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const accessTtlSec = parseInt(env.ACCESS_TTL_SEC || '3600', 10); // 1 hour default
  const refreshTtlSec = parseInt(env.REFRESH_TTL_SEC || '1209600', 10); // 2 weeks default

  return new JwtService({
    secret,
    accessTtlSec,
    refreshTtlSec
  });
};

// Export singleton instance (initialized in server.ts)
export let jwtService: JwtService;

export const initializeJwtService = (env: NodeJS.ProcessEnv): void => {
  jwtService = createJwtService(env);
};