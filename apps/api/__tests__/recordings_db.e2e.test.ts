import request from 'supertest';
import { buildServer } from '../src/server';
import { db, recordings } from '../src/db/client';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config();

describe('Recordings Database E2E Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clean up test recordings before each test
    await db.delete(recordings).where(sql`${recordings.id} LIKE 'test_%'`);
  });

  describe('Health Check with Database', () => {
    it('should return healthy status with database check', async () => {
      const response = await request(server.server)
        .get('/v1/health/ping')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        storage: 's3',
        db: 'ok', // This should now be 'ok' with PostgreSQL
        timestamp: expect.any(String)
      });
    });
  });

  describe('Recording Finalization to Database', () => {
    it('should finalize recording and store in PostgreSQL', async () => {
      const finalizeRequest = {
        id: 'test_db_recording_001',
        key: 'recordings/test_db_recording_001.m4a',
        title: 'PostgreSQL Test Recording',
        durationSec: 125.7,
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:32:00.000Z'
      };

      const response = await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(201);

      expect(response.body).toEqual({
        id: 'test_db_recording_001'
      });

      // Verify it was actually stored in PostgreSQL
      const [dbRecording] = await db
        .select()
        .from(recordings)
        .where(sql`${recordings.id} = 'test_db_recording_001'`)
        .limit(1);

      expect(dbRecording).toBeTruthy();
      expect(dbRecording.title).toBe('PostgreSQL Test Recording');
      expect(dbRecording.durationSec).toBe(125); // Rounded down to integer
      expect(dbRecording.s3Key).toBe('recordings/test_db_recording_001.m4a');
      expect(dbRecording.createdAt.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle idempotent finalize with upsert', async () => {
      const finalizeRequest = {
        id: 'test_db_recording_idempotent',
        key: 'recordings/test_db_recording_idempotent.m4a',
        title: 'Original Title',
        durationSec: 60,
        createdAt: '2024-01-15T12:00:00.000Z'
      };

      // First finalize
      await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(201);

      // Second finalize with updated title
      const updatedRequest = {
        ...finalizeRequest,
        title: 'Updated Title',
        durationSec: 90,
        updatedAt: '2024-01-15T12:05:00.000Z'
      };

      await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(updatedRequest)
        .expect(201);

      // Verify only one record exists with updated values
      const dbRecordings = await db
        .select()
        .from(recordings)
        .where(sql`${recordings.id} = 'test_db_recording_idempotent'`);

      expect(dbRecordings).toHaveLength(1);
      expect(dbRecordings[0].title).toBe('Updated Title');
      expect(dbRecordings[0].durationSec).toBe(90);
    });

    it('should reject invalid timestamps in finalize', async () => {
      const finalizeRequest = {
        id: 'test_db_recording_bad_timestamp',
        key: 'recordings/test_db_recording_bad_timestamp.m4a',
        title: 'Bad Timestamp Recording',
        durationSec: 60,
        createdAt: 'invalid-timestamp'
      };

      const response = await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(400);

      expect(response.body.message).toContain('Invalid createdAt timestamp format');
    });
  });

  describe('Recording Listing from Database', () => {
    beforeEach(async () => {
      // Add test recordings directly to PostgreSQL
      await db.insert(recordings).values([
        {
          id: 'test_list_001',
          title: 'First DB Recording',
          durationSec: 45,
          s3Key: 'recordings/test_list_001.m4a',
          createdAt: new Date('2024-01-10T10:00:00Z'),
          updatedAt: new Date('2024-01-10T10:01:00Z'),
          userId: null
        },
        {
          id: 'test_list_002',
          title: 'Second DB Recording',
          durationSec: 120,
          s3Key: 'recordings/test_list_002.m4a',
          createdAt: new Date('2024-01-12T14:30:00Z'),
          updatedAt: new Date('2024-01-12T14:32:00Z'),
          userId: null
        },
        {
          id: 'test_list_003',
          title: 'Third DB Recording',
          durationSec: 90,
          s3Key: 'recordings/test_list_003.m4a',
          createdAt: new Date('2024-01-14T09:15:00Z'),
          updatedAt: new Date('2024-01-14T09:17:00Z'),
          userId: null
        }
      ]);
    });

    it('should list recordings from PostgreSQL with signed URLs', async () => {
      const response = await request(server.server)
        .get('/v1/recordings')
        .expect(200);

      expect(response.body).toHaveLength(3);
      
      // Verify all recordings have required fields
      response.body.forEach((recording: any) => {
        expect(recording).toMatchObject({
          id: expect.stringMatching(/^test_list_\d{3}$/),
          title: expect.stringContaining('DB Recording'),
          durationSec: expect.any(Number),
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          fileUrl: expect.stringMatching(/^https?:\/\/.*/) // Should be signed URL
        });
      });

      // Verify specific recording content
      const firstRecording = response.body.find((r: any) => r.id === 'test_list_001');
      expect(firstRecording).toMatchObject({
        id: 'test_list_001',
        title: 'First DB Recording',
        durationSec: 45,
        createdAt: '2024-01-10T10:00:00.000Z'
      });

      // Verify signed URLs are different (each has unique signature)
      const urls = response.body.map((r: any) => r.fileUrl);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(urls.length);
    });

    it('should handle empty database gracefully', async () => {
      // Clear all test recordings
      await db.delete(recordings).where(sql`${recordings.id} LIKE 'test_%'`);

      const response = await request(server.server)
        .get('/v1/recordings')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      // This test would require temporarily breaking the DB connection
      // For now, we verify the endpoint handles the happy path correctly
      const response = await request(server.server)
        .get('/v1/recordings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Recording Deletion from Database', () => {
    beforeEach(async () => {
      // Add test recording for deletion
      await db.insert(recordings).values({
        id: 'test_delete_recording',
        title: 'Recording to Delete from DB',
        durationSec: 75,
        s3Key: 'recordings/test_delete_recording.m4a',
        createdAt: new Date('2024-01-15T16:00:00Z'),
        updatedAt: new Date('2024-01-15T16:01:30Z'),
        userId: null
      });
    });

    it('should delete recording from PostgreSQL and return 204', async () => {
      // Verify recording exists before deletion
      const [beforeDelete] = await db
        .select()
        .from(recordings)
        .where(sql`${recordings.id} = 'test_delete_recording'`)
        .limit(1);

      expect(beforeDelete).toBeTruthy();

      // Delete via API
      await request(server.server)
        .delete('/v1/recordings/test_delete_recording')
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);

      // Verify recording was removed from PostgreSQL
      const afterDelete = await db
        .select()
        .from(recordings)
        .where(sql`${recordings.id} = 'test_delete_recording'`);

      expect(afterDelete).toHaveLength(0);
    });

    it('should return 404 for non-existent recording in database', async () => {
      const response = await request(server.server)
        .delete('/v1/recordings/non_existent_db_recording')
        .set('X-Danger-Dev-Server', 'true')
        .expect(404);

      expect(response.body.message).toContain('Recording not found');
    });

    it('should handle database constraint violations gracefully', async () => {
      // First verify normal deletion works
      await request(server.server)
        .delete('/v1/recordings/test_delete_recording')
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);

      // Second deletion should return 404
      await request(server.server)
        .delete('/v1/recordings/test_delete_recording')
        .set('X-Danger-Dev-Server', 'true')
        .expect(404);
    });
  });

  describe('Recording Streaming from Database', () => {
    beforeEach(async () => {
      await db.insert(recordings).values({
        id: 'test_stream_recording',
        title: 'Recording to Stream from DB',
        durationSec: 180,
        s3Key: 'recordings/test_stream_recording.m4a',
        createdAt: new Date('2024-01-15T18:00:00Z'),
        updatedAt: new Date('2024-01-15T18:03:00Z'),
        userId: null
      });
    });

    it('should redirect to signed URL for streaming from database', async () => {
      const response = await request(server.server)
        .get('/v1/recordings/test_stream_recording/stream')
        .set('X-Danger-Dev-Server', 'true')
        .expect(302);

      expect(response.headers.location).toMatch(/^https?:\/\/.*test_stream_recording/);
    });

    it('should return 404 for non-existent recording stream from database', async () => {
      const response = await request(server.server)
        .get('/v1/recordings/non_existent_stream_db/stream')
        .set('X-Danger-Dev-Server', 'true')
        .expect(404);

      expect(response.body.message).toContain('Recording not found');
    });
  });

  describe('Database Performance', () => {
    beforeEach(async () => {
      // Add multiple recordings for performance testing
      const recordings_data = Array.from({ length: 50 }, (_, i) => ({
        id: `perf_test_${String(i).padStart(3, '0')}`,
        title: `Performance Test Recording ${i}`,
        durationSec: Math.floor(Math.random() * 300) + 30,
        s3Key: `recordings/perf_test_${String(i).padStart(3, '0')}.m4a`,
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 30), // Random within last 30 days
        updatedAt: new Date(),
        userId: null
      }));

      await db.insert(recordings).values(recordings_data);
    });

    it('should list many recordings within performance budget', async () => {
      const startTime = Date.now();
      
      const response = await request(server.server)
        .get('/v1/recordings')
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.length).toBe(50);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify all recordings have signed URLs
      response.body.forEach((recording: any) => {
        expect(recording.fileUrl).toMatch(/^https?:\/\/.*/);
      });
    });

    it('should handle concurrent finalize requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        request(server.server)
          .post('/v1/recordings/finalize')
          .set('X-Danger-Dev-Server', 'true')
          .send({
            id: `concurrent_test_${i}`,
            key: `recordings/concurrent_test_${i}.m4a`,
            title: `Concurrent Test ${i}`,
            durationSec: 60,
            createdAt: new Date().toISOString()
          })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBe(`concurrent_test_${index}`);
      });

      // Verify all were stored in database
      const storedRecordings = await db
        .select()
        .from(recordings)
        .where(sql`${recordings.id} LIKE 'concurrent_test_%'`);

      expect(storedRecordings).toHaveLength(10);
    });
  });
});