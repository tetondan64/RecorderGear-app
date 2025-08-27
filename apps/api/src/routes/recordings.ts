import { FastifyPluginAsync } from 'fastify';
import { s3 } from '../lib/s3';
import { db, recordings } from '../db/client';
import { getCurrentTimestamp, isValidTimestamp } from '../lib/time';
import { isValidRecordingId, isValidRecordingKey } from '../lib/ids';
import { generateUserRecordingKey } from '../lib/s3-keys';
import { requireAuth, getAuthUserId } from '../middleware/auth';
import { eq, sql } from 'drizzle-orm';
import type { 
  PresignRequest, 
  PresignResponse, 
  FinalizeRequest, 
  FinalizeResponse,
  RecordingResponse,
  ErrorResponse 
} from '../types';

/**
 * Recording management routes: presign, finalize, list, delete
 */
const recordingsRoutes: FastifyPluginAsync = async (fastify) => {
  
  // POST /v1/uploads/presign - Generate presigned PUT URL (requires auth)
  fastify.post<{
    Body: PresignRequest;
    Reply: PresignResponse | ErrorResponse;
  }>('/v1/uploads/presign', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['id', 'contentType', 'sizeBytes'],
        properties: {
          id: { type: 'string', minLength: 1 },
          contentType: { type: 'string', minLength: 1 },
          sizeBytes: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id, contentType, sizeBytes } = request.body;

      // Validate ID format
      if (!isValidRecordingId(id)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid recording ID format',
          statusCode: 400
        });
      }

      // Validate content type
      if (contentType !== 'audio/m4a') {
        return reply.code(400).send({
          error: 'Bad Request', 
          message: 'Content type must be audio/m4a',
          statusCode: 400
        });
      }

      // Validate file size (max 100MB)
      if (sizeBytes > 100 * 1024 * 1024) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'File size too large (max 100MB)',
          statusCode: 400
        });
      }

      // Get authenticated user ID and generate presigned URL with user prefix
      const userId = getAuthUserId(request);
      const presignData = await s3.getPresignedPutUrl(id, contentType, userId);
      
      fastify.log.info(`Generated presigned PUT URL for recording: ${id}`);
      
      return reply.code(200).send(presignData);
    } catch (error: any) {
      fastify.log.error('Presign request failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate upload URL',
        statusCode: 500
      });
    }
  });

  // POST /v1/recordings/finalize - Finalize upload and store metadata (requires auth)
  fastify.post<{
    Body: FinalizeRequest;
    Reply: FinalizeResponse | ErrorResponse;
  }>('/v1/recordings/finalize', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['id', 'key', 'title', 'durationSec', 'createdAt'],
        properties: {
          id: { type: 'string', minLength: 1 },
          key: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1, maxLength: 255 },
          durationSec: { type: 'number', minimum: 0 },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id, key, title, durationSec, createdAt, updatedAt } = request.body;

      // Validate ID and key format
      if (!isValidRecordingId(id)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid recording ID format',
          statusCode: 400
        });
      }

      if (!isValidRecordingKey(key)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid recording key format',
          statusCode: 400
        });
      }

      // Validate timestamps
      if (!isValidTimestamp(createdAt)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid createdAt timestamp format',
          statusCode: 400
        });
      }

      if (updatedAt && !isValidTimestamp(updatedAt)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid updatedAt timestamp format',
          statusCode: 400
        });
      }

      // Get authenticated user ID and store metadata in PostgreSQL database
      const userId = getAuthUserId(request);
      
      await db
        .insert(recordings)
        .values({
          id,
          userId, // Associate with authenticated user
          title,
          durationSec,
          s3Key: key, // Map 'key' to 's3Key' column
          createdAt: new Date(createdAt),
          updatedAt: new Date(updatedAt || getCurrentTimestamp()),
          deletedAt: null, // Not deleted on creation
        })
        .onConflictDoUpdate({
          target: recordings.id,
          set: {
            title,
            durationSec,
            s3Key: key,
            updatedAt: new Date(updatedAt || getCurrentTimestamp()),
          },
        });

      fastify.log.info(`Finalized recording: ${id} (${title})`);

      return reply.code(201).send({ id });
    } catch (error: any) {
      fastify.log.error('Finalize request failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to finalize recording',
        statusCode: 500
      });
    }
  });

  // GET /v1/recordings - List user's recordings with signed URLs (requires auth)
  fastify.get<{
    Reply: RecordingResponse[] | ErrorResponse;
  }>('/v1/recordings', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      // Get authenticated user ID and query their recordings only
      const userId = getAuthUserId(request);
      
      const recordingsList = await db
        .select({
          id: recordings.id,
          title: recordings.title,
          durationSec: recordings.durationSec,
          s3Key: recordings.s3Key,
          createdAt: recordings.createdAt,
        })
        .from(recordings)
        .where(eq(recordings.userId, userId))
        .where(sql`${recordings.deletedAt} IS NULL`) // Only non-deleted recordings
        .orderBy(recordings.createdAt); // Most recent first
      
      // Generate signed GET URLs for each recording
      const recordingsWithUrls = await Promise.all(
        recordingsList.map(async (recording) => {
          try {
            const fileUrl = await s3.getPresignedGetUrl(recording.s3Key);
            return {
              id: recording.id,
              title: recording.title,
              durationSec: recording.durationSec,
              createdAt: recording.createdAt.toISOString(),
              fileUrl
            };
          } catch (error: any) {
            fastify.log.warn(`Failed to generate URL for recording ${recording.id}:`, error);
            // Return with placeholder URL if signing fails
            return {
              id: recording.id,
              title: recording.title,
              durationSec: recording.durationSec,
              createdAt: recording.createdAt.toISOString(),
              fileUrl: ''
            };
          }
        })
      );

      fastify.log.info(`Listed ${recordingsList.length} recordings`);
      
      return reply.code(200).send(recordingsWithUrls);
    } catch (error: any) {
      fastify.log.error('List recordings failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list recordings',
        statusCode: 500
      });
    }
  });

  // DELETE /v1/recordings/:id - Delete user's recording and S3 object (requires auth)
  fastify.delete<{
    Params: { id: string };
    Reply: '' | ErrorResponse;
  }>('/v1/recordings/:id', {
    preHandler: requireAuth,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = getAuthUserId(request);

      // Get recording metadata from PostgreSQL database (user-scoped)
      const [recording] = await db
        .select({
          id: recordings.id,
          s3Key: recordings.s3Key,
          userId: recordings.userId,
        })
        .from(recordings)
        .where(eq(recordings.id, id))
        .limit(1);

      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        });
      }

      // Soft delete the recording (set deletedAt timestamp)
      const deletedRows = await db
        .update(recordings)
        .set({
          deletedAt: sql`NOW()`,
          updatedAt: sql`NOW()` // Update timestamp for sync
        })
        .where(eq(recordings.id, id));
      
      // TODO: Schedule S3 cleanup in background job
      // For now, we keep the S3 object for potential recovery
      
      if (!deletedRows) {
        fastify.log.warn(`Recording metadata not found during deletion: ${id}`);
      }

      fastify.log.info(`Deleted recording: ${id}`);
      
      return reply.code(204).send();
    } catch (error: any) {
      fastify.log.error('Delete recording failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete recording',
        statusCode: 500
      });
    }
  });

  // Optional: GET /v1/recordings/:id/stream - Proxy stream for direct playback (requires auth)
  fastify.get<{
    Params: { id: string };
  }>('/v1/recordings/:id/stream', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = getAuthUserId(request);
      
      // Get recording from PostgreSQL database (user-scoped)
      const [recording] = await db
        .select({
          id: recordings.id,
          s3Key: recordings.s3Key,
          userId: recordings.userId,
        })
        .from(recordings)
        .where(eq(recordings.id, id))
        .limit(1);

      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        });
      }

      // Generate a short-lived signed URL and redirect
      const signedUrl = await s3.getPresignedGetUrl(recording.s3Key);
      
      return reply.redirect(302, signedUrl);
    } catch (error: any) {
      fastify.log.error('Stream recording failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to stream recording',
        statusCode: 500
      });
    }
  });
};

export default recordingsRoutes;