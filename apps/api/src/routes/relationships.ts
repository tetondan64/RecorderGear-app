import { FastifyPluginAsync } from 'fastify';
import { db, recordings, tags, folders, recordingTags, recordingFolders } from '../db/client';
import { eq, and, inArray } from 'drizzle-orm';
import type { 
  RecordingWithMetaResponse,
  ErrorResponse 
} from '../types';
import { 
  recordingTagAssignSchema, 
  recordingFolderAssignSchema 
} from '../types';

/**
 * Recording relationships management routes
 * Handles tag assignments and folder assignments for recordings
 * Business Rules:
 * - One recording can belong to only one folder (or none)
 * - One recording can have multiple tags
 * - Operations are idempotent (adding existing tag/folder is no-op)
 */
const relationshipsRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /v1/recordings/:id/tags - Assign/remove tags to/from recording
  fastify.post<{
    Params: { id: string };
    Body: { tagId: string; op: 'add' | 'remove' };
    Reply: { success: boolean } | ErrorResponse;
  }>('/v1/recordings/:id/tags', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        required: ['tagId', 'op'],
        properties: {
          tagId: { type: 'string', format: 'uuid' },
          op: { type: 'string', enum: ['add', 'remove'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: recordingId } = request.params;
      const { tagId, op } = recordingTagAssignSchema.parse({
        recordingId,
        ...request.body
      });

      // Verify recording exists
      const [recording] = await db
        .select({ id: recordings.id })
        .from(recordings)
        .where(eq(recordings.id, recordingId))
        .limit(1);

      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        });
      }

      // Verify tag exists
      const [tag] = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      if (!tag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tag not found',
          statusCode: 404
        });
      }

      if (op === 'add') {
        // Add tag to recording (idempotent)
        try {
          await db
            .insert(recordingTags)
            .values({ recordingId, tagId })
            .onConflictDoNothing(); // Idempotent: ignore if already exists

          fastify.log.info(`Added tag ${tag.name} to recording ${recordingId}`);
        } catch (error: any) {
          // Handle any unexpected constraint violations
          if (error.code === '23505') {
            // Already exists, which is fine (idempotent)
            fastify.log.debug(`Tag ${tagId} already assigned to recording ${recordingId}`);
          } else {
            throw error;
          }
        }
      } else if (op === 'remove') {
        // Remove tag from recording (idempotent)
        const deletedRows = await db
          .delete(recordingTags)
          .where(and(
            eq(recordingTags.recordingId, recordingId),
            eq(recordingTags.tagId, tagId)
          ));

        fastify.log.info(`Removed tag ${tag.name} from recording ${recordingId} (${deletedRows ? 'found' : 'not found'})`);
      }

      return reply.code(200).send({ success: true });

    } catch (error: any) {
      fastify.log.error('Recording tag assignment failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to assign/remove tag',
        statusCode: 500
      });
    }
  });

  // POST /v1/recordings/:id/folder - Move recording to folder (or remove from folder)
  fastify.post<{
    Params: { id: string };
    Body: { folderId: string | null };
    Reply: { success: boolean } | ErrorResponse;
  }>('/v1/recordings/:id/folder', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        required: ['folderId'],
        properties: {
          folderId: { type: ['string', 'null'], format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: recordingId } = request.params;
      const { folderId } = recordingFolderAssignSchema.parse({
        recordingId,
        ...request.body
      });

      // Verify recording exists
      const [recording] = await db
        .select({ id: recordings.id })
        .from(recordings)
        .where(eq(recordings.id, recordingId))
        .limit(1);

      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        });
      }

      // If folderId is provided, verify folder exists
      if (folderId) {
        const [folder] = await db
          .select({ id: folders.id, name: folders.name })
          .from(folders)
          .where(eq(folders.id, folderId))
          .limit(1);

        if (!folder) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Folder not found',
            statusCode: 404
          });
        }
      }

      if (folderId) {
        // Assign recording to folder (replace existing assignment)
        await db
          .insert(recordingFolders)
          .values({ recordingId, folderId })
          .onConflictDoUpdate({
            target: recordingFolders.recordingId,
            set: { 
              folderId,
              createdAt: new Date() // Update timestamp on folder change
            }
          });

        fastify.log.info(`Moved recording ${recordingId} to folder ${folderId}`);
      } else {
        // Remove recording from any folder
        const deletedRows = await db
          .delete(recordingFolders)
          .where(eq(recordingFolders.recordingId, recordingId));

        fastify.log.info(`Removed recording ${recordingId} from folder (${deletedRows ? 'found' : 'not found'})`);
      }

      return reply.code(200).send({ success: true });

    } catch (error: any) {
      fastify.log.error('Recording folder assignment failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to assign/remove folder',
        statusCode: 500
      });
    }
  });

  // GET /v1/recordings/:id/metadata - Get recording with tags and folder info
  fastify.get<{
    Params: { id: string };
    Reply: RecordingWithMetaResponse | ErrorResponse;
  }>('/v1/recordings/:id/metadata', {
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
      const { id: recordingId } = request.params;

      // Get recording with basic info
      const [recording] = await db
        .select({
          id: recordings.id,
          title: recordings.title,
          durationSec: recordings.durationSec,
          s3Key: recordings.s3Key,
          createdAt: recordings.createdAt,
        })
        .from(recordings)
        .where(eq(recordings.id, recordingId))
        .limit(1);

      if (!recording) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Recording not found',
          statusCode: 404
        });
      }

      // Get assigned tags
      const recordingTagsList = await db
        .select({
          tagId: recordingTags.tagId,
        })
        .from(recordingTags)
        .where(eq(recordingTags.recordingId, recordingId));

      const tagIds = recordingTagsList.map(rt => rt.tagId);

      // Get folder assignment
      const [folderAssignment] = await db
        .select({
          folderId: recordingFolders.folderId,
        })
        .from(recordingFolders)
        .where(eq(recordingFolders.recordingId, recordingId))
        .limit(1);

      // Generate signed URL for file access (using existing S3 service)
      const { s3 } = await import('../lib/s3');
      let fileUrl = '';
      try {
        fileUrl = await s3.getPresignedGetUrl(recording.s3Key);
      } catch (error) {
        fastify.log.warn(`Failed to generate signed URL for recording ${recordingId}:`, error);
      }

      const response: RecordingWithMetaResponse = {
        id: recording.id,
        title: recording.title,
        durationSec: recording.durationSec,
        createdAt: recording.createdAt.toISOString(),
        fileUrl,
        ...(folderAssignment && { folderId: folderAssignment.folderId }),
        ...(tagIds.length > 0 && { tagIds }),
      };

      return reply.code(200).send(response);

    } catch (error: any) {
      fastify.log.error('Get recording metadata failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get recording metadata',
        statusCode: 500
      });
    }
  });

  // GET /v1/folders/:id/recordings - Get recordings in a folder
  fastify.get<{
    Params: { id: string };
    Reply: RecordingWithMetaResponse[] | ErrorResponse;
  }>('/v1/folders/:id/recordings', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: folderId } = request.params;

      // Verify folder exists
      const [folder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(eq(folders.id, folderId))
        .limit(1);

      if (!folder) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Folder not found',
          statusCode: 404
        });
      }

      // Get recordings in folder
      const recordingsList = await db
        .select({
          id: recordings.id,
          title: recordings.title,
          durationSec: recordings.durationSec,
          s3Key: recordings.s3Key,
          createdAt: recordings.createdAt,
        })
        .from(recordings)
        .innerJoin(recordingFolders, eq(recordings.id, recordingFolders.recordingId))
        .where(eq(recordingFolders.folderId, folderId))
        .orderBy(recordings.createdAt);

      // Get tags for each recording (batch query)
      const recordingIds = recordingsList.map(r => r.id);
      let tagsMap = new Map<string, string[]>();

      if (recordingIds.length > 0) {
        const allRecordingTags = await db
          .select({
            recordingId: recordingTags.recordingId,
            tagId: recordingTags.tagId,
          })
          .from(recordingTags)
          .where(inArray(recordingTags.recordingId, recordingIds));

        // Group tags by recording
        for (const rt of allRecordingTags) {
          if (!tagsMap.has(rt.recordingId)) {
            tagsMap.set(rt.recordingId, []);
          }
          tagsMap.get(rt.recordingId)!.push(rt.tagId);
        }
      }

      // Generate signed URLs and build response
      const { s3 } = await import('../lib/s3');
      const recordingsWithMeta = await Promise.all(
        recordingsList.map(async (recording) => {
          let fileUrl = '';
          try {
            fileUrl = await s3.getPresignedGetUrl(recording.s3Key);
          } catch (error) {
            fastify.log.warn(`Failed to generate URL for recording ${recording.id}:`, error);
          }

          const tagIds = tagsMap.get(recording.id) || [];

          const response: RecordingWithMetaResponse = {
            id: recording.id,
            title: recording.title,
            durationSec: recording.durationSec,
            createdAt: recording.createdAt.toISOString(),
            fileUrl,
            folderId,
            ...(tagIds.length > 0 && { tagIds }),
          };

          return response;
        })
      );

      fastify.log.info(`Listed ${recordingsWithMeta.length} recordings in folder ${folderId}`);

      return reply.code(200).send(recordingsWithMeta);

    } catch (error: any) {
      fastify.log.error('Get folder recordings failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get folder recordings',
        statusCode: 500
      });
    }
  });

  // GET /v1/tags/:id/recordings - Get recordings with a specific tag
  fastify.get<{
    Params: { id: string };
    Reply: RecordingWithMetaResponse[] | ErrorResponse;
  }>('/v1/tags/:id/recordings', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tagId } = request.params;

      // Verify tag exists
      const [tag] = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      if (!tag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tag not found',
          statusCode: 404
        });
      }

      // Get recordings with this tag
      const recordingsList = await db
        .select({
          id: recordings.id,
          title: recordings.title,
          durationSec: recordings.durationSec,
          s3Key: recordings.s3Key,
          createdAt: recordings.createdAt,
        })
        .from(recordings)
        .innerJoin(recordingTags, eq(recordings.id, recordingTags.recordingId))
        .where(eq(recordingTags.tagId, tagId))
        .orderBy(recordings.createdAt);

      // Get all tags for each recording (batch query)
      const recordingIds = recordingsList.map(r => r.id);
      let tagsMap = new Map<string, string[]>();
      let foldersMap = new Map<string, string>();

      if (recordingIds.length > 0) {
        // Get all tags
        const allRecordingTags = await db
          .select({
            recordingId: recordingTags.recordingId,
            tagId: recordingTags.tagId,
          })
          .from(recordingTags)
          .where(inArray(recordingTags.recordingId, recordingIds));

        // Get folder assignments
        const allRecordingFolders = await db
          .select({
            recordingId: recordingFolders.recordingId,
            folderId: recordingFolders.folderId,
          })
          .from(recordingFolders)
          .where(inArray(recordingFolders.recordingId, recordingIds));

        // Group tags by recording
        for (const rt of allRecordingTags) {
          if (!tagsMap.has(rt.recordingId)) {
            tagsMap.set(rt.recordingId, []);
          }
          tagsMap.get(rt.recordingId)!.push(rt.tagId);
        }

        // Map folders by recording
        for (const rf of allRecordingFolders) {
          foldersMap.set(rf.recordingId, rf.folderId);
        }
      }

      // Generate signed URLs and build response
      const { s3 } = await import('../lib/s3');
      const recordingsWithMeta = await Promise.all(
        recordingsList.map(async (recording) => {
          let fileUrl = '';
          try {
            fileUrl = await s3.getPresignedGetUrl(recording.s3Key);
          } catch (error) {
            fastify.log.warn(`Failed to generate URL for recording ${recording.id}:`, error);
          }

          const tagIds = tagsMap.get(recording.id) || [];
          const folderId = foldersMap.get(recording.id);

          const response: RecordingWithMetaResponse = {
            id: recording.id,
            title: recording.title,
            durationSec: recording.durationSec,
            createdAt: recording.createdAt.toISOString(),
            fileUrl,
            ...(folderId && { folderId }),
            ...(tagIds.length > 0 && { tagIds }),
          };

          return response;
        })
      );

      fastify.log.info(`Listed ${recordingsWithMeta.length} recordings with tag ${tag.name}`);

      return reply.code(200).send(recordingsWithMeta);

    } catch (error: any) {
      fastify.log.error('Get tag recordings failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get tag recordings',
        statusCode: 500
      });
    }
  });
};

export default relationshipsRoutes;