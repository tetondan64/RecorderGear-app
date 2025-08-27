import { FastifyPluginAsync } from 'fastify';
import { db, folders, recordingFolders } from '../db/client';
import { eq, and, isNull, count, sql } from 'drizzle-orm';
import type { 
  FolderResponse, 
  ErrorResponse 
} from '../types';
import { folderCreateSchema, folderUpdateSchema } from '../types';

/**
 * Folders management routes: create, list, update, delete
 * Business Rules:
 * - Maximum 2-level hierarchy (root → child folders only)
 * - Cannot delete folder with recordings or child folders (409 conflict)
 * - Folder names must be unique per user at the same level
 */
const foldersRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /v1/folders - Create folder
  fastify.post<{
    Body: { name: string; parentId?: string };
    Reply: FolderResponse | ErrorResponse;
  }>('/v1/folders', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          parentId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, parentId } = folderCreateSchema.parse(request.body);

      // Validate depth constraint: if parentId provided, ensure it's not a child folder
      if (parentId) {
        const parentFolder = await db
          .select({ id: folders.id, parentId: folders.parentId })
          .from(folders)
          .where(eq(folders.id, parentId))
          .limit(1);

        if (parentFolder.length === 0) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Parent folder not found',
            statusCode: 404
          });
        }

        // Check if parent already has a parent (would violate depth <=2 rule)
        if (parentFolder[0].parentId) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Cannot create folder: maximum depth of 2 levels exceeded',
            statusCode: 400
          });
        }
      }

      // Create folder
      const [newFolder] = await db
        .insert(folders)
        .values({
          name,
          parentId: parentId || null,
          userId: null, // Dev mode: no user association
        })
        .returning({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
        });

      fastify.log.info(`Created folder: ${newFolder.id} (${name})`);

      return reply.code(201).send({
        id: newFolder.id,
        name: newFolder.name,
        parentId: newFolder.parentId,
        createdAt: newFolder.createdAt.toISOString(),
      });

    } catch (error: any) {
      fastify.log.error('Create folder failed:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Folder name already exists at this level',
          statusCode: 409
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create folder',
        statusCode: 500
      });
    }
  });

  // GET /v1/folders - List folders with hierarchy and recording counts
  fastify.get<{
    Reply: FolderResponse[] | ErrorResponse;
  }>('/v1/folders', async (request, reply) => {
    try {
      // Get all folders with recording counts
      const foldersWithCounts = await db
        .select({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
          recordingCount: count(recordingFolders.recordingId),
        })
        .from(folders)
        .leftJoin(recordingFolders, eq(folders.id, recordingFolders.folderId))
        .groupBy(folders.id, folders.name, folders.parentId, folders.createdAt)
        .orderBy(folders.createdAt);

      const response: FolderResponse[] = foldersWithCounts.map(folder => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt.toISOString(),
        recordingCount: folder.recordingCount,
      }));

      fastify.log.info(`Listed ${response.length} folders`);

      return reply.code(200).send(response);
    } catch (error: any) {
      fastify.log.error('List folders failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list folders',
        statusCode: 500
      });
    }
  });

  // PUT /v1/folders/:id - Update folder
  fastify.put<{
    Params: { id: string };
    Body: { name?: string; parentId?: string };
    Reply: FolderResponse | ErrorResponse;
  }>('/v1/folders/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          parentId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updateData = folderUpdateSchema.parse(request.body);

      // Check if folder exists
      const [existingFolder] = await db
        .select({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
        })
        .from(folders)
        .where(eq(folders.id, id))
        .limit(1);

      if (!existingFolder) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Folder not found',
          statusCode: 404
        });
      }

      // Validate depth constraint if parentId is being changed
      if (updateData.parentId) {
        // Check if trying to set self as parent
        if (updateData.parentId === id) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Cannot set folder as its own parent',
            statusCode: 400
          });
        }

        // Check if new parent exists and validate depth
        const parentFolder = await db
          .select({ id: folders.id, parentId: folders.parentId })
          .from(folders)
          .where(eq(folders.id, updateData.parentId))
          .limit(1);

        if (parentFolder.length === 0) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Parent folder not found',
            statusCode: 404
          });
        }

        // Check if parent already has a parent (would violate depth <=2 rule)
        if (parentFolder[0].parentId) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Cannot move folder: maximum depth of 2 levels exceeded',
            statusCode: 400
          });
        }

        // Check if folder has children (would violate depth <=2 rule)
        const hasChildren = await db
          .select({ count: count() })
          .from(folders)
          .where(eq(folders.parentId, id));

        if (hasChildren[0].count > 0) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Cannot move folder with children: maximum depth of 2 levels exceeded',
            statusCode: 400
          });
        }
      }

      // Update folder
      const [updatedFolder] = await db
        .update(folders)
        .set({
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.parentId !== undefined && { parentId: updateData.parentId || null }),
        })
        .where(eq(folders.id, id))
        .returning({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
        });

      fastify.log.info(`Updated folder: ${id}`);

      return reply.code(200).send({
        id: updatedFolder.id,
        name: updatedFolder.name,
        parentId: updatedFolder.parentId,
        createdAt: updatedFolder.createdAt.toISOString(),
      });

    } catch (error: any) {
      fastify.log.error('Update folder failed:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Folder name already exists at this level',
          statusCode: 409
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update folder',
        statusCode: 500
      });
    }
  });

  // DELETE /v1/folders/:id - Delete folder (with safety checks)
  fastify.delete<{
    Params: { id: string };
    Reply: '' | ErrorResponse;
  }>('/v1/folders/:id', {
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
      const { id } = request.params;

      // Check if folder exists
      const [existingFolder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(eq(folders.id, id))
        .limit(1);

      if (!existingFolder) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Folder not found',
          statusCode: 404
        });
      }

      // Check if folder has recordings
      const recordingCount = await db
        .select({ count: count() })
        .from(recordingFolders)
        .where(eq(recordingFolders.folderId, id));

      if (recordingCount[0].count > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `Cannot delete folder: contains ${recordingCount[0].count} recordings`,
          statusCode: 409
        });
      }

      // Check if folder has child folders
      const childCount = await db
        .select({ count: count() })
        .from(folders)
        .where(eq(folders.parentId, id));

      if (childCount[0].count > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `Cannot delete folder: contains ${childCount[0].count} child folders`,
          statusCode: 409
        });
      }

      // Delete folder (safe to delete)
      await db
        .delete(folders)
        .where(eq(folders.id, id));

      fastify.log.info(`Deleted folder: ${id}`);

      return reply.code(204).send();
    } catch (error: any) {
      fastify.log.error('Delete folder failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete folder',
        statusCode: 500
      });
    }
  });

  // GET /v1/folders/:id - Get single folder with details
  fastify.get<{
    Params: { id: string };
    Reply: FolderResponse | ErrorResponse;
  }>('/v1/folders/:id', {
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
      const { id } = request.params;

      // Get folder with recording count
      const [folderWithCount] = await db
        .select({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          createdAt: folders.createdAt,
          recordingCount: count(recordingFolders.recordingId),
        })
        .from(folders)
        .leftJoin(recordingFolders, eq(folders.id, recordingFolders.folderId))
        .where(eq(folders.id, id))
        .groupBy(folders.id, folders.name, folders.parentId, folders.createdAt)
        .limit(1);

      if (!folderWithCount) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Folder not found',
          statusCode: 404
        });
      }

      return reply.code(200).send({
        id: folderWithCount.id,
        name: folderWithCount.name,
        parentId: folderWithCount.parentId,
        createdAt: folderWithCount.createdAt.toISOString(),
        recordingCount: folderWithCount.recordingCount,
      });

    } catch (error: any) {
      fastify.log.error('Get folder failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get folder',
        statusCode: 500
      });
    }
  });
};

export default foldersRoutes;