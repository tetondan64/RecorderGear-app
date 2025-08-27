import { FastifyPluginAsync } from 'fastify';
import { db, users, devices, refreshTokens, emailOtps } from '../db/client';
import { jwtService } from '../lib/jwt';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { 
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  EmailOtpRequest,
  EmailOtpResponse,
  EmailVerifyRequest,
  EmailVerifyResponse,
  ErrorResponse
} from '../types';

/**
 * Authentication routes: device registration, token refresh, email OTP
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /v1/auth/device/register - Anonymous device registration
  fastify.post<{
    Body: DeviceRegisterRequest;
    Reply: DeviceRegisterResponse | ErrorResponse;
  }>('/v1/auth/device/register', {
    schema: {
      body: {
        type: 'object',
        properties: {
          userAgent: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userAgent } = request.body || {};

      // Generate device ID
      const deviceId = jwtService.generateDeviceId();

      // Create anonymous user first
      const [user] = await db
        .insert(users)
        .values({
          email: null, // Anonymous - no email yet
        })
        .returning();

      // Register device
      await db
        .insert(devices)
        .values({
          id: deviceId,
          userId: user.id,
          userAgent: userAgent || null,
        });

      // Generate tokens
      const accessToken = jwtService.generateAccessToken(user.id, deviceId);
      const refreshToken = jwtService.generateRefreshToken(user.id, deviceId);

      // Store refresh token (hash it for security)
      const tokenHash = Buffer.from(refreshToken).toString('base64');
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 1209600); // 2 weeks

      await db
        .insert(refreshTokens)
        .values({
          userId: user.id,
          deviceId,
          tokenHash,
          expiresAt,
        });

      fastify.log.info(`Device registered: ${deviceId} for user: ${user.id}`);

      return reply.code(201).send({
        userId: user.id,
        deviceId,
        accessToken,
        refreshToken,
        accessExpiresInSec: 3600, // 1 hour
        refreshExpiresInSec: 1209600, // 2 weeks
      });

    } catch (error: any) {
      fastify.log.error('Device registration failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to register device',
        statusCode: 500
      });
    }
  });

  // POST /v1/auth/token/refresh - Refresh access token
  fastify.post<{
    Body: TokenRefreshRequest;
    Reply: TokenRefreshResponse | ErrorResponse;
  }>('/v1/auth/token/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body;

      // Verify refresh token
      const payload = jwtService.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        return reply.code(401).send({
          error: 'Invalid Token',
          message: 'Invalid token type. Refresh token required.',
          statusCode: 401
        });
      }

      // Check if refresh token exists and is not revoked
      const tokenHash = Buffer.from(refreshToken).toString('base64');
      const [storedToken] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.userId, payload.userId),
            eq(refreshTokens.deviceId, payload.deviceId),
            eq(refreshTokens.tokenHash, tokenHash),
            isNull(refreshTokens.revokedAt)
          )
        )
        .limit(1);

      if (!storedToken) {
        return reply.code(401).send({
          error: 'Invalid Token',
          message: 'Refresh token not found or revoked',
          statusCode: 401
        });
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        return reply.code(401).send({
          error: 'Token Expired',
          message: 'Refresh token has expired',
          statusCode: 401
        });
      }

      // Generate new access token
      const newAccessToken = jwtService.generateAccessToken(payload.userId, payload.deviceId);

      // Update device last seen
      await db
        .update(devices)
        .set({
          lastSeenAt: sql`NOW()`
        })
        .where(eq(devices.id, payload.deviceId));

      fastify.log.info(`Token refreshed for user: ${payload.userId}, device: ${payload.deviceId}`);

      return reply.code(200).send({
        accessToken: newAccessToken,
        accessExpiresInSec: 3600, // 1 hour
      });

    } catch (error: any) {
      if (error.message === 'TOKEN_EXPIRED') {
        return reply.code(401).send({
          error: 'Token Expired',
          message: 'Refresh token has expired',
          statusCode: 401
        });
      } else if (error.message === 'TOKEN_INVALID') {
        return reply.code(401).send({
          error: 'Invalid Token',
          message: 'Refresh token is malformed',
          statusCode: 401
        });
      }

      fastify.log.error('Token refresh failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to refresh token',
        statusCode: 500
      });
    }
  });

  // POST /v1/auth/email/request - Request email OTP
  fastify.post<{
    Body: EmailOtpRequest;
    Reply: EmailOtpResponse | ErrorResponse;
  }>('/v1/auth/email/request', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'deviceId'],
        properties: {
          email: { type: 'string', format: 'email' },
          deviceId: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, deviceId } = request.body;

      // Validate device exists
      const [device] = await db
        .select()
        .from(devices)
        .where(eq(devices.id, deviceId))
        .limit(1);

      if (!device) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid device ID',
          statusCode: 400
        });
      }

      // Generate OTP
      const otp = jwtService.generateOtp(6);
      const otpHash = jwtService.hashOtp(otp);
      
      // Set expiration (5 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      // Clean up any existing OTPs for this email/device
      await db
        .delete(emailOtps)
        .where(
          and(
            eq(emailOtps.email, email),
            eq(emailOtps.deviceId, deviceId)
          )
        );

      // Store OTP
      await db
        .insert(emailOtps)
        .values({
          email,
          deviceId,
          otpHash,
          expiresAt,
        });

      fastify.log.info(`OTP requested for email: ${email}, device: ${deviceId}`);

      // In development, return OTP in response
      const isDev = process.env.NODE_ENV !== 'production';

      return reply.code(200).send({
        message: 'OTP sent to email',
        expiresInSec: 300, // 5 minutes
        ...(isDev && { otp }) // Only include OTP in dev mode
      });

    } catch (error: any) {
      fastify.log.error('Email OTP request failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send OTP',
        statusCode: 500
      });
    }
  });

  // POST /v1/auth/email/verify - Verify email OTP and link to device
  fastify.post<{
    Body: EmailVerifyRequest;
    Reply: EmailVerifyResponse | ErrorResponse;
  }>('/v1/auth/email/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'deviceId', 'otp'],
        properties: {
          email: { type: 'string', format: 'email' },
          deviceId: { type: 'string', minLength: 1 },
          otp: { type: 'string', minLength: 4 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, deviceId, otp } = request.body;

      // Find the most recent unverified OTP
      const [storedOtp] = await db
        .select()
        .from(emailOtps)
        .where(
          and(
            eq(emailOtps.email, email),
            eq(emailOtps.deviceId, deviceId),
            isNull(emailOtps.verifiedAt)
          )
        )
        .orderBy(desc(emailOtps.createdAt))
        .limit(1);

      if (!storedOtp) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'No valid OTP found for this email and device',
          statusCode: 400
        });
      }

      // Check expiration
      if (storedOtp.expiresAt < new Date()) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'OTP has expired',
          statusCode: 400
        });
      }

      // Verify OTP
      if (!jwtService.verifyOtp(otp, storedOtp.otpHash)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid OTP',
          statusCode: 400
        });
      }

      // Get device and user
      const [device] = await db
        .select({
          id: devices.id,
          userId: devices.userId,
        })
        .from(devices)
        .where(eq(devices.id, deviceId))
        .limit(1);

      if (!device || !device.userId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid device',
          statusCode: 400
        });
      }

      // Update user with email
      await db
        .update(users)
        .set({
          email: email
        })
        .where(eq(users.id, device.userId));

      // Mark OTP as verified
      await db
        .update(emailOtps)
        .set({
          verifiedAt: sql`NOW()`
        })
        .where(eq(emailOtps.id, storedOtp.id));

      // Revoke all existing refresh tokens to force re-login
      await db
        .update(refreshTokens)
        .set({
          revokedAt: sql`NOW()`
        })
        .where(eq(refreshTokens.userId, device.userId));

      // Generate new tokens
      const accessToken = jwtService.generateAccessToken(device.userId, deviceId);
      const refreshToken = jwtService.generateRefreshToken(device.userId, deviceId);

      // Store new refresh token
      const tokenHash = Buffer.from(refreshToken).toString('base64');
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 1209600); // 2 weeks

      await db
        .insert(refreshTokens)
        .values({
          userId: device.userId,
          deviceId,
          tokenHash,
          expiresAt,
        });

      fastify.log.info(`Email verified and linked: ${email} to user: ${device.userId}`);

      return reply.code(200).send({
        userId: device.userId,
        email,
        accessToken,
        refreshToken,
        accessExpiresInSec: 3600,
        refreshExpiresInSec: 1209600,
      });

    } catch (error: any) {
      fastify.log.error('Email verification failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify email',
        statusCode: 500
      });
    }
  });
};

export default authRoutes;