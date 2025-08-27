import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env, validateEnvironment } from './lib/env';
import { s3 } from './lib/s3';
import { checkDatabaseHealth } from './db/client';
import { initializeJwtService } from './lib/jwt';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import recordingsRoutes from './routes/recordings';
import syncRoutes from './routes/sync';
import foldersRoutes from './routes/folders';
import tagsRoutes from './routes/tags';
import relationshipsRoutes from './routes/relationships';
import type { ErrorResponse } from './types';

/**
 * RecorderGear API Server
 * Provides S3-compatible cloud storage with presigned URLs
 */
async function buildServer() {
  const loggerConfig = env.NODE_ENV === 'development' 
    ? {
        level: 'info' as const,
        transport: {
          target: 'pino-pretty'
        }
      }
    : {
        level: 'warn' as const
      };

  const fastify = Fastify({
    logger: loggerConfig
  });

  // Enable CORS for development
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Danger-Dev-Server']
  });

  // Add request logging and dev server validation
  fastify.addHook('preHandler', async (request, reply) => {
    // Log request
    fastify.log.info(`${request.method} ${request.url}`);
    
    // Simple dev server gate - require special header for non-GET requests
    if (env.NODE_ENV === 'development' && 
        request.method !== 'GET' && 
        request.headers['x-danger-dev-server'] !== 'true') {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Development server requires X-Danger-Dev-Server header',
        statusCode: 403
      });
    }
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(syncRoutes);
  await fastify.register(recordingsRoutes);
  await fastify.register(foldersRoutes);
  await fastify.register(tagsRoutes);
  await fastify.register(relationshipsRoutes);

  // Global error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    fastify.log.error('Unhandled error: %s', error.message);
    
    if (error.statusCode) {
      const errorResponse: ErrorResponse = {
        error: error.name || 'Error',
        message: error.message,
        statusCode: error.statusCode
      };
      return reply.code(error.statusCode).send(errorResponse);
    }
    
    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500
    };
    return reply.code(500).send(errorResponse);
  });

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404
    });
  });

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  try {
    console.log('🚀 Starting RecorderGear API Server...');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize services
    await s3.initialize();
    initializeJwtService(process.env);
    
    // Check database connection
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error('Database health check failed - ensure PostgreSQL is running');
    }
    console.log('✅ Database connection verified');
    
    // Build and start server
    const server = await buildServer();
    
    await server.listen({ 
      port: env.PORT, 
      host: '0.0.0.0' // Bind to all interfaces for LAN access
    });
    
    console.log(`✅ Server running at http://0.0.0.0:${env.PORT}`);
    console.log(`📡 Health check: http://localhost:${env.PORT}/v1/health/ping`);
    console.log('🎵 Ready for recordings!');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server if this file is run directly
if (require.main === module) {
  start();
}

export { buildServer, start };