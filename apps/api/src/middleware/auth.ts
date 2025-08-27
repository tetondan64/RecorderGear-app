import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string;
      deviceId: string;
    };
  }
}

interface AuthOptions {
  required?: boolean;
}

/**
 * Auth middleware for Fastify routes
 * Validates Bearer token and sets request.auth
 */
export const authPreHandler = (options: AuthOptions = { required: true }) => {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const authorization = request.headers.authorization;

      // Handle missing authorization header
      if (!authorization) {
        if (options.required) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authorization header required',
            statusCode: 401
          });
        }
        return; // Optional auth - continue without setting request.auth
      }

      // Validate Bearer format
      if (!authorization.startsWith('Bearer ')) {
        if (options.required) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid authorization format. Use: Bearer <token>',
            statusCode: 401
          });
        }
        return;
      }

      // Extract token
      const token = authorization.substring(7); // Remove 'Bearer '
      if (!token) {
        if (options.required) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Token required',
            statusCode: 401
          });
        }
        return;
      }

      // Verify token
      const payload = jwtService.verifyToken(token);

      // Ensure it's an access token
      if (payload.type !== 'access') {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid token type. Access token required.',
          statusCode: 401
        });
      }

      // Set auth context
      request.auth = {
        userId: payload.userId,
        deviceId: payload.deviceId
      };

      request.log.debug(`Auth success: user=${payload.userId}, device=${payload.deviceId}`);
    } catch (error: any) {
      // Handle specific JWT errors
      if (error.message === 'TOKEN_EXPIRED') {
        return reply.code(401).send({
          error: 'Token Expired',
          message: 'Access token has expired. Please refresh.',
          statusCode: 401
        });
      } else if (error.message === 'TOKEN_INVALID') {
        return reply.code(401).send({
          error: 'Invalid Token',
          message: 'Token is malformed or invalid',
          statusCode: 401
        });
      } else {
        request.log.error('Auth verification failed:', error);
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Token verification failed',
          statusCode: 401
        });
      }
    }
  };
};

/**
 * Convenience helper for required auth
 */
export const requireAuth = authPreHandler({ required: true });

/**
 * Convenience helper for optional auth
 */
export const optionalAuth = authPreHandler({ required: false });

/**
 * Generate S3 key with user prefix
 */
export const generateUserS3Key = (userId: string, recordingId: string): string => {
  return `u/${userId}/recordings/${recordingId}.m4a`;
};

/**
 * Utility to get authenticated user ID from request
 */
export const getAuthUserId = (request: FastifyRequest): string => {
  if (!request.auth?.userId) {
    throw new Error('Request not authenticated. Use requireAuth preHandler.');
  }
  return request.auth.userId;
};