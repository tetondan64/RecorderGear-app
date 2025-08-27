import { FastifyPluginAsync } from 'fastify';
import { requireAuth, getAuthUserId } from '../middleware/auth';
import { getChangesSinceCursor, validateCursor } from '../db/sync';
import type { ErrorResponse } from '../types';

interface SyncChangesQuery {
  since?: string;
  limit?: string;
}

/**
 * Sync routes for incremental pull/merge synchronization
 */
const syncRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /v1/sync/changes - Get changes since cursor for authenticated user
  fastify.get<{
    Querystring: SyncChangesQuery;
  }>('/v1/sync/changes', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string' },
          limit: { 
            type: 'string',
            pattern: '^[0-9]+$' // Ensure it's a valid number string
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = getAuthUserId(request);
      const { since, limit: limitStr } = request.query;
      
      // Validate and parse cursor
      let cursor;
      try {
        cursor = validateCursor(since);
      } catch (error: any) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
          statusCode: 400
        });
      }
      
      // Parse and validate limit
      const limit = limitStr ? parseInt(limitStr, 10) : 500;
      if (limit < 1 || limit > 1000) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Limit must be between 1 and 1000',
          statusCode: 400
        });
      }
      
      // Get changes from database
      const result = await getChangesSinceCursor(userId, cursor, limit);
      
      fastify.log.info(`Sync changes: user=${userId}, since=${since || 'initial'}, returned=${result.items.length} items, hasMore=${result.hasMore}`);
      
      return reply.code(200).send(result);
    } catch (error: any) {
      fastify.log.error('Sync changes request failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch sync changes',
        statusCode: 500
      });
    }
  });
};

export default syncRoutes;