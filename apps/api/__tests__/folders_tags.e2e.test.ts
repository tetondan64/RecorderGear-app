import request from 'supertest';
import { buildServer } from '../src/server';
import { db, folders, tags, recordings, recordingTags, recordingFolders } from '../src/db/client';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config();

describe('Folders and Tags E2E Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clean up test data in correct order (foreign keys)
    await db.delete(recordingTags).where(sql`1=1`);
    await db.delete(recordingFolders).where(sql`1=1`);
    await db.delete(recordings).where(sql`${recordings.id} LIKE 'test_%'`);
    await db.delete(tags).where(sql`${tags.name} LIKE 'Test%' OR ${tags.name} LIKE 'test%'`);
    await db.delete(folders).where(sql`${folders.name} LIKE 'Test%' OR ${folders.name} LIKE 'test%'`);
  });

  describe('Folder Hierarchy Depth Rules', () => {
    it('should allow creating root folder', async () => {
      const response = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Test Root Folder'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Root Folder',
        parentId: null,
        createdAt: expect.any(String)
      });
    });

    it('should allow creating child folder under root', async () => {
      // Create root folder first
      const rootResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Test Root' })
        .expect(201);

      const rootFolderId = rootResponse.body.id;

      // Create child folder
      const childResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Test Child',
          parentId: rootFolderId
        })
        .expect(201);

      expect(childResponse.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Child',
        parentId: rootFolderId,
        createdAt: expect.any(String)
      });
    });

    it('should reject creating grandchild folder (depth > 2)', async () => {
      // Create root folder
      const rootResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Test Root' })
        .expect(201);

      const rootFolderId = rootResponse.body.id;

      // Create child folder
      const childResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Test Child',
          parentId: rootFolderId
        })
        .expect(201);

      const childFolderId = childResponse.body.id;

      // Attempt to create grandchild folder (should fail)
      const grandchildResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Test Grandchild',
          parentId: childFolderId
        })
        .expect(400);

      expect(grandchildResponse.body.message).toContain('maximum depth of 2 levels exceeded');
    });

    it('should reject moving folder with children to create depth > 2', async () => {
      // Create root and child folders
      const rootResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Root 1' })
        .expect(201);

      const childResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Child of Root 1',
          parentId: rootResponse.body.id
        })
        .expect(201);

      // Create another root folder
      const root2Response = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Root 2' })
        .expect(201);

      const child2Response = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Child of Root 2',
          parentId: root2Response.body.id
        })
        .expect(201);

      // Attempt to move Root 1 under Child of Root 2 (would create depth 3)
      const moveResponse = await request(server.server)
        .put(`/v1/folders/${rootResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .send({
          parentId: child2Response.body.id
        })
        .expect(400);

      expect(moveResponse.body.message).toContain('maximum depth of 2 levels exceeded');
    });

    it('should reject setting folder as its own parent', async () => {
      const folderResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Self Reference Test' })
        .expect(201);

      const folderId = folderResponse.body.id;

      const updateResponse = await request(server.server)
        .put(`/v1/folders/${folderId}`)
        .set('X-Danger-Dev-Server', 'true')
        .send({ parentId: folderId })
        .expect(400);

      expect(updateResponse.body.message).toContain('Cannot set folder as its own parent');
    });
  });

  describe('Folder Safe Delete Rules', () => {
    it('should allow deleting empty folder', async () => {
      const folderResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Empty Folder' })
        .expect(201);

      await request(server.server)
        .delete(`/v1/folders/${folderResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);
    });

    it('should reject deleting folder with recordings', async () => {
      // Create folder
      const folderResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Folder with Recordings' })
        .expect(201);

      // Add recording to database
      const [recording] = await db.insert(recordings).values({
        id: 'test_recording_in_folder',
        title: 'Recording in Folder',
        durationSec: 60,
        s3Key: 'recordings/test_recording_in_folder.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null
      }).returning();

      // Assign recording to folder
      await db.insert(recordingFolders).values({
        recordingId: recording.id,
        folderId: folderResponse.body.id
      });

      // Attempt to delete folder (should fail)
      const deleteResponse = await request(server.server)
        .delete(`/v1/folders/${folderResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(409);

      expect(deleteResponse.body.message).toContain('contains 1 recordings');
    });

    it('should reject deleting folder with child folders', async () => {
      // Create parent folder
      const parentResponse = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Parent Folder' })
        .expect(201);

      // Create child folder
      await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({
          name: 'Child Folder',
          parentId: parentResponse.body.id
        })
        .expect(201);

      // Attempt to delete parent folder (should fail)
      const deleteResponse = await request(server.server)
        .delete(`/v1/folders/${parentResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(409);

      expect(deleteResponse.body.message).toContain('contains 1 child folders');
    });

    it('should return folder listing with recording counts', async () => {
      // Create folders
      const folder1Response = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Folder One' })
        .expect(201);

      const folder2Response = await request(server.server)
        .post('/v1/folders')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Folder Two' })
        .expect(201);

      // Add recordings
      const recordings_data = [
        {
          id: 'test_folder_rec_1',
          title: 'Recording 1',
          durationSec: 60,
          s3Key: 'recordings/test_folder_rec_1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: null
        },
        {
          id: 'test_folder_rec_2',
          title: 'Recording 2',
          durationSec: 90,
          s3Key: 'recordings/test_folder_rec_2.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: null
        }
      ];

      const insertedRecordings = await db.insert(recordings).values(recordings_data).returning();

      // Assign recordings to folders
      await db.insert(recordingFolders).values([
        { recordingId: insertedRecordings[0].id, folderId: folder1Response.body.id },
        { recordingId: insertedRecordings[1].id, folderId: folder1Response.body.id }
      ]);

      // List folders
      const listResponse = await request(server.server)
        .get('/v1/folders')
        .expect(200);

      expect(listResponse.body).toHaveLength(2);
      
      const folder1 = listResponse.body.find((f: any) => f.name === 'Folder One');
      const folder2 = listResponse.body.find((f: any) => f.name === 'Folder Two');

      expect(folder1.recordingCount).toBe(2);
      expect(folder2.recordingCount).toBe(0);
    });
  });

  describe('Tag Uniqueness Rules', () => {
    it('should create tag with case-sensitive name', async () => {
      const response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'TestTag' })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'TestTag',
        createdAt: expect.any(String)
      });
    });

    it('should reject duplicate tag names (case-insensitive)', async () => {
      // Create first tag
      await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'DuplicateTest' })
        .expect(201);

      // Attempt to create tag with different case (should fail)
      const duplicateResponse = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'duplicatetest' })
        .expect(409);

      expect(duplicateResponse.body.message).toContain('Tag name already exists (case-insensitive)');
    });

    it('should reject duplicate tag names with mixed case', async () => {
      await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'Important' })
        .expect(201);

      const responses = await Promise.all([
        request(server.server)
          .post('/v1/tags')
          .set('X-Danger-Dev-Server', 'true')
          .send({ name: 'IMPORTANT' })
          .expect(409),
        
        request(server.server)
          .post('/v1/tags')
          .set('X-Danger-Dev-Server', 'true')
          .send({ name: 'important' })
          .expect(409),
          
        request(server.server)
          .post('/v1/tags')
          .set('X-Danger-Dev-Server', 'true')
          .send({ name: 'ImPoRtAnT' })
          .expect(409)
      ]);

      responses.forEach(response => {
        expect(response.body.message).toContain('case-insensitive');
      });
    });

    it('should handle tag name normalization (trim whitespace)', async () => {
      const response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: '  Whitespace Test  ' })
        .expect(201);

      expect(response.body.name).toBe('Whitespace Test');
    });

    it('should reject empty tag names after trimming', async () => {
      const response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.message).toContain('Tag name cannot be empty');
    });

    it('should allow updating tag name while enforcing uniqueness', async () => {
      // Create two tags
      const tag1Response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'OriginalName' })
        .expect(201);

      await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'ExistingName' })
        .expect(201);

      // Update first tag to new name (should succeed)
      const updateResponse = await request(server.server)
        .put(`/v1/tags/${tag1Response.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'UpdatedName' })
        .expect(200);

      expect(updateResponse.body.name).toBe('UpdatedName');

      // Attempt to update to existing name (should fail)
      const conflictResponse = await request(server.server)
        .put(`/v1/tags/${tag1Response.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'existingname' })
        .expect(409);

      expect(conflictResponse.body.message).toContain('case-insensitive');
    });
  });

  describe('Tag Safe Delete Rules', () => {
    it('should allow deleting unused tag', async () => {
      const tagResponse = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'UnusedTag' })
        .expect(201);

      await request(server.server)
        .delete(`/v1/tags/${tagResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);
    });

    it('should reject deleting tag in use without force flag', async () => {
      // Create tag
      const tagResponse = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'UsedTag' })
        .expect(201);

      // Add recording
      const [recording] = await db.insert(recordings).values({
        id: 'test_tagged_recording',
        title: 'Tagged Recording',
        durationSec: 60,
        s3Key: 'recordings/test_tagged_recording.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null
      }).returning();

      // Assign tag to recording
      await db.insert(recordingTags).values({
        recordingId: recording.id,
        tagId: tagResponse.body.id
      });

      // Attempt to delete tag without force (should fail)
      const deleteResponse = await request(server.server)
        .delete(`/v1/tags/${tagResponse.body.id}`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(409);

      expect(deleteResponse.body.message).toContain('used by 1 recordings');
      expect(deleteResponse.body.message).toContain('Use force=true');
    });

    it('should allow deleting tag in use with force flag', async () => {
      // Create tag and assign to recording
      const tagResponse = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'ForceDeleteTag' })
        .expect(201);

      const [recording] = await db.insert(recordings).values({
        id: 'test_force_delete_recording',
        title: 'Force Delete Recording',
        durationSec: 60,
        s3Key: 'recordings/test_force_delete_recording.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null
      }).returning();

      await db.insert(recordingTags).values({
        recordingId: recording.id,
        tagId: tagResponse.body.id
      });

      // Delete with force flag (should succeed)
      await request(server.server)
        .delete(`/v1/tags/${tagResponse.body.id}?force=true`)
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);

      // Verify tag and relationship were deleted
      const remainingTags = await db
        .select()
        .from(tags)
        .where(sql`${tags.id} = ${tagResponse.body.id}`);

      const remainingRelations = await db
        .select()
        .from(recordingTags)
        .where(sql`${recordingTags.tagId} = ${tagResponse.body.id}`);

      expect(remainingTags).toHaveLength(0);
      expect(remainingRelations).toHaveLength(0);
    });

    it('should return tag listing with usage counts', async () => {
      // Create tags
      const tag1Response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'PopularTag' })
        .expect(201);

      const tag2Response = await request(server.server)
        .post('/v1/tags')
        .set('X-Danger-Dev-Server', 'true')
        .send({ name: 'UnusedTag' })
        .expect(201);

      // Add recordings
      const recordings_data = [
        {
          id: 'test_usage_rec_1',
          title: 'Usage Test 1',
          durationSec: 30,
          s3Key: 'recordings/test_usage_rec_1.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: null
        },
        {
          id: 'test_usage_rec_2',
          title: 'Usage Test 2',
          durationSec: 45,
          s3Key: 'recordings/test_usage_rec_2.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: null
        }
      ];

      const insertedRecordings = await db.insert(recordings).values(recordings_data).returning();

      // Assign popular tag to both recordings
      await db.insert(recordingTags).values([
        { recordingId: insertedRecordings[0].id, tagId: tag1Response.body.id },
        { recordingId: insertedRecordings[1].id, tagId: tag1Response.body.id }
      ]);

      // List tags
      const listResponse = await request(server.server)
        .get('/v1/tags')
        .expect(200);

      expect(listResponse.body).toHaveLength(2);

      const popularTag = listResponse.body.find((t: any) => t.name === 'PopularTag');
      const unusedTag = listResponse.body.find((t: any) => t.name === 'UnusedTag');

      expect(popularTag.usageCount).toBe(2);
      expect(unusedTag.usageCount).toBe(0);
    });

    it('should support tag search functionality', async () => {
      // Create multiple tags
      await Promise.all([
        request(server.server).post('/v1/tags').set('X-Danger-Dev-Server', 'true').send({ name: 'SearchTestOne' }),
        request(server.server).post('/v1/tags').set('X-Danger-Dev-Server', 'true').send({ name: 'SearchTestTwo' }),
        request(server.server).post('/v1/tags').set('X-Danger-Dev-Server', 'true').send({ name: 'DifferentTag' })
      ]);

      // Search for tags containing "Search"
      const searchResponse = await request(server.server)
        .get('/v1/tags?search=Search')
        .expect(200);

      expect(searchResponse.body).toHaveLength(2);
      searchResponse.body.forEach((tag: any) => {
        expect(tag.name).toContain('Search');
      });

      // Search for non-existent term
      const emptyResponse = await request(server.server)
        .get('/v1/tags?search=NonExistent')
        .expect(200);

      expect(emptyResponse.body).toHaveLength(0);
    });
  });
});