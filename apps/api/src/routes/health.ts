import { FastifyPluginAsync } from 'fastify';
import { getCurrentTimestamp } from '../lib/time';
import { checkDatabaseHealth } from '../db/client';
import type { HealthResponse } from '../types';

/**
 * Health check routes for API status and connectivity testing
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/health/ping - Basic health check
  fastify.get<{
    Reply: HealthResponse;
  }>('/v1/health/ping', async (request, reply) => {
    try {
      // Check database health
      const dbHealthy = await checkDatabaseHealth();
      
      const response: HealthResponse = {
        ok: true,
        storage: 's3',
        db: dbHealthy ? 'ok' : 'error',
        timestamp: getCurrentTimestamp(),
      };

      return reply.code(200).send(response);
    } catch (error: any) {
      fastify.log.error('Health check failed: %s', error?.message || String(error));
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Health check failed',
        statusCode: 500,
      } as any);
    }
  });
};

export default healthRoutes;