import { FastifyPluginAsync } from 'fastify';
import { db, tags, recordingTags } from '../db/client';
import { eq, count, sql, ilike } from 'drizzle-orm';
import type { 
  TagResponse, 
  ErrorResponse 
} from '../types';
import { tagCreateSchema, tagUpdateSchema } from '../types';

/**
 * Tags management routes: create, list, update, delete
 * Business Rules:
 * - Tag names are case-insensitive unique per user
 * - Cannot delete tag with recordings unless force=true query parameter
 * - Tag names are normalized (trimmed, case standardized)
 */
const tagsRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /v1/tags - Create tag
  fastify.post<{
    Body: { name: string };
    Reply: TagResponse | ErrorResponse;
  }>('/v1/tags', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name } = tagCreateSchema.parse(request.body);
      
      // Normalize tag name (trim whitespace, preserve original case for display)
      const normalizedName = name.trim();
      
      if (!normalizedName) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Tag name cannot be empty',
          statusCode: 400
        });
      }

      // Check for case-insensitive duplicate
      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(ilike(tags.name, normalizedName))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tag name already exists (case-insensitive)',
          statusCode: 409
        });
      }

      // Create tag
      const [newTag] = await db
        .insert(tags)
        .values({
          name: normalizedName,
          userId: null, // Dev mode: no user association
        })
        .returning({
          id: tags.id,
          name: tags.name,
          createdAt: tags.createdAt,
        });

      fastify.log.info(`Created tag: ${newTag.id} (${normalizedName})`);

      return reply.code(201).send({
        id: newTag.id,
        name: newTag.name,
        createdAt: newTag.createdAt.toISOString(),
      });

    } catch (error: any) {
      fastify.log.error('Create tag failed:', error);
      
      // Handle unique constraint violation (backup protection)
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tag name already exists',
          statusCode: 409
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create tag',
        statusCode: 500
      });
    }
  });

  // GET /v1/tags - List tags with usage counts
  fastify.get<{
    Querystring: { search?: string };
    Reply: TagResponse[] | ErrorResponse;
  }>('/v1/tags', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { search } = request.query;

      // Build query with optional search filter
      let query = db
        .select({
          id: tags.id,
          name: tags.name,
          createdAt: tags.createdAt,
          usageCount: count(recordingTags.recordingId),
        })
        .from(tags)
        .leftJoin(recordingTags, eq(tags.id, recordingTags.tagId))
        .groupBy(tags.id, tags.name, tags.createdAt);

      // Add search filter if provided
      if (search) {
        query = query.where(ilike(tags.name, `%${search.trim()}%`));
      }

      const tagsWithCounts = await query.orderBy(tags.name);

      const response: TagResponse[] = tagsWithCounts.map(tag => ({
        id: tag.id,
        name: tag.name,
        createdAt: tag.createdAt.toISOString(),
        usageCount: tag.usageCount,
      }));

      fastify.log.info(`Listed ${response.length} tags${search ? ` (search: ${search})` : ''}`);

      return reply.code(200).send(response);
    } catch (error: any) {
      fastify.log.error('List tags failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list tags',
        statusCode: 500
      });
    }
  });

  // PUT /v1/tags/:id - Update tag
  fastify.put<{
    Params: { id: string };
    Body: { name: string };
    Reply: TagResponse | ErrorResponse;
  }>('/v1/tags/:id', {
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
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name } = tagUpdateSchema.parse(request.body);

      // Normalize tag name
      const normalizedName = name.trim();
      
      if (!normalizedName) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Tag name cannot be empty',
          statusCode: 400
        });
      }

      // Check if tag exists
      const [existingTag] = await db
        .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt })
        .from(tags)
        .where(eq(tags.id, id))
        .limit(1);

      if (!existingTag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tag not found',
          statusCode: 404
        });
      }

      // Check for case-insensitive duplicate (excluding current tag)
      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(sql`lower(${tags.name}) = lower(${normalizedName}) AND ${tags.id} != ${id}`)
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tag name already exists (case-insensitive)',
          statusCode: 409
        });
      }

      // Update tag
      const [updatedTag] = await db
        .update(tags)
        .set({ name: normalizedName })
        .where(eq(tags.id, id))
        .returning({
          id: tags.id,
          name: tags.name,
          createdAt: tags.createdAt,
        });

      fastify.log.info(`Updated tag: ${id} (${normalizedName})`);

      return reply.code(200).send({
        id: updatedTag.id,
        name: updatedTag.name,
        createdAt: updatedTag.createdAt.toISOString(),
      });

    } catch (error: any) {
      fastify.log.error('Update tag failed:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Tag name already exists',
          statusCode: 409
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update tag',
        statusCode: 500
      });
    }
  });

  // DELETE /v1/tags/:id - Delete tag (with safety checks)
  fastify.delete<{
    Params: { id: string };
    Querystring: { force?: boolean };
    Reply: '' | ErrorResponse;
  }>('/v1/tags/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          force: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { force } = request.query;

      // Check if tag exists
      const [existingTag] = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(eq(tags.id, id))
        .limit(1);

      if (!existingTag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tag not found',
          statusCode: 404
        });
      }

      // Check if tag is in use
      const usageCount = await db
        .select({ count: count() })
        .from(recordingTags)
        .where(eq(recordingTags.tagId, id));

      if (usageCount[0].count > 0 && !force) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `Cannot delete tag: used by ${usageCount[0].count} recordings. Use force=true to delete anyway.`,
          statusCode: 409
        });
      }

      // Delete tag (this will cascade delete recording_tags relationships)
      await db
        .delete(tags)
        .where(eq(tags.id, id));

      fastify.log.info(`Deleted tag: ${id} (${existingTag.name})${force ? ' [forced]' : ''}`);

      return reply.code(204).send();
    } catch (error: any) {
      fastify.log.error('Delete tag failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete tag',
        statusCode: 500
      });
    }
  });

  // GET /v1/tags/:id - Get single tag with details
  fastify.get<{
    Params: { id: string };
    Reply: TagResponse | ErrorResponse;
  }>('/v1/tags/:id', {
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

      // Get tag with usage count
      const [tagWithCount] = await db
        .select({
          id: tags.id,
          name: tags.name,
          createdAt: tags.createdAt,
          usageCount: count(recordingTags.recordingId),
        })
        .from(tags)
        .leftJoin(recordingTags, eq(tags.id, recordingTags.tagId))
        .where(eq(tags.id, id))
        .groupBy(tags.id, tags.name, tags.createdAt)
        .limit(1);

      if (!tagWithCount) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tag not found',
          statusCode: 404
        });
      }

      return reply.code(200).send({
        id: tagWithCount.id,
        name: tagWithCount.name,
        createdAt: tagWithCount.createdAt.toISOString(),
        usageCount: tagWithCount.usageCount,
      });

    } catch (error: any) {
      fastify.log.error('Get tag failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get tag',
        statusCode: 500
      });
    }
  });
};

export default tagsRoutes;