import request from 'supertest';
import { buildServer } from '../src/server';
import { db } from '../src/lib/db';
import type { FastifyInstance } from 'fastify';

describe('Recordings E2E Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await db.initialize();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(server.server)
        .get('/v1/health/ping')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        storage: 's3',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Presign Upload Flow', () => {
    it('should generate presigned PUT URL', async () => {
      const presignRequest = {
        id: 'test_recording_123',
        contentType: 'audio/m4a',
        sizeBytes: 1024000
      };

      const response = await request(server.server)
        .post('/v1/uploads/presign')
        .set('X-Danger-Dev-Server', 'true')
        .send(presignRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        url: expect.stringContaining('http'),
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'audio/m4a'
        }),
        key: 'recordings/test_recording_123.m4a',
        expiresSec: expect.any(Number)
      });
    });

    it('should reject invalid content type', async () => {
      const presignRequest = {
        id: 'test_recording_123',
        contentType: 'application/json',
        sizeBytes: 1024000
      };

      const response = await request(server.server)
        .post('/v1/uploads/presign')
        .set('X-Danger-Dev-Server', 'true')
        .send(presignRequest)
        .expect(400);

      expect(response.body.message).toContain('Content type must be audio/m4a');
    });

    it('should reject oversized files', async () => {
      const presignRequest = {
        id: 'test_recording_123',
        contentType: 'audio/m4a',
        sizeBytes: 101 * 1024 * 1024 // 101MB
      };

      const response = await request(server.server)
        .post('/v1/uploads/presign')
        .set('X-Danger-Dev-Server', 'true')
        .send(presignRequest)
        .expect(400);

      expect(response.body.message).toContain('File size too large');
    });
  });

  describe('Finalize Recording Flow', () => {
    it('should finalize recording with metadata', async () => {
      const finalizeRequest = {
        id: 'test_recording_456',
        key: 'recordings/test_recording_456.m4a',
        title: 'Test Recording',
        durationSec: 120.5,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:02:00.000Z'
      };

      const response = await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(201);

      expect(response.body).toEqual({
        id: 'test_recording_456'
      });

      // Verify it was stored in database
      const recording = await db.getRecording('test_recording_456');
      expect(recording).toBeTruthy();
      expect(recording?.title).toBe('Test Recording');
    });

    it('should be idempotent (allow duplicate finalize)', async () => {
      const finalizeRequest = {
        id: 'test_recording_789',
        key: 'recordings/test_recording_789.m4a',
        title: 'Duplicate Test',
        durationSec: 60,
        createdAt: '2024-01-01T12:00:00.000Z'
      };

      // First finalize
      await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(201);

      // Second finalize (should succeed)
      await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(201);

      const allRecordings = await db.getAllRecordings();
      const duplicateCount = allRecordings.filter(r => r.id === 'test_recording_789').length;
      expect(duplicateCount).toBe(1); // Should only have one entry
    });

    it('should reject invalid recording key format', async () => {
      const finalizeRequest = {
        id: 'test_recording_bad',
        key: 'invalid/path/file.mp3',
        title: 'Bad Recording',
        durationSec: 60,
        createdAt: '2024-01-01T12:00:00.000Z'
      };

      const response = await request(server.server)
        .post('/v1/recordings/finalize')
        .set('X-Danger-Dev-Server', 'true')
        .send(finalizeRequest)
        .expect(400);

      expect(response.body.message).toContain('Invalid recording key format');
    });
  });

  describe('List Recordings', () => {
    beforeEach(async () => {
      // Add test recordings to database
      await db.addRecording({
        id: 'recording_1',
        key: 'recordings/recording_1.m4a',
        title: 'First Recording',
        durationSec: 30,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:01:00.000Z'
      });

      await db.addRecording({
        id: 'recording_2',
        key: 'recordings/recording_2.m4a',
        title: 'Second Recording',
        durationSec: 60,
        createdAt: '2024-01-02T10:00:00.000Z',
        updatedAt: '2024-01-02T10:01:00.000Z'
      });
    });

    it('should list all recordings with signed URLs', async () => {
      const response = await request(server.server)
        .get('/v1/recordings')
        .set('X-Danger-Dev-Server', 'true')
        .expect(200);

      expect(response.body).toHaveLength(2);
      
      const firstRecording = response.body.find((r: any) => r.id === 'recording_1');
      expect(firstRecording).toMatchObject({
        id: 'recording_1',
        title: 'First Recording',
        durationSec: 30,
        createdAt: '2024-01-01T10:00:00.000Z',
        fileUrl: expect.stringContaining('http')
      });

      // Verify fileUrl is a valid presigned URL
      expect(firstRecording.fileUrl).toMatch(/^https?:\/\/.+/);
    });

    it('should return empty array when no recordings', async () => {
      // Clear all recordings
      const recordings = await db.getAllRecordings();
      for (const recording of recordings) {
        await db.deleteRecording(recording.id);
      }

      const response = await request(server.server)
        .get('/v1/recordings')
        .set('X-Danger-Dev-Server', 'true')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('Delete Recording', () => {
    beforeEach(async () => {
      // Add a test recording
      await db.addRecording({
        id: 'recording_to_delete',
        key: 'recordings/recording_to_delete.m4a',
        title: 'Recording to Delete',
        durationSec: 45,
        createdAt: '2024-01-01T15:00:00.000Z'
      });
    });

    it('should delete recording and return 204', async () => {
      await request(server.server)
        .delete('/v1/recordings/recording_to_delete')
        .set('X-Danger-Dev-Server', 'true')
        .expect(204);

      // Verify it was removed from database
      const recording = await db.getRecording('recording_to_delete');
      expect(recording).toBeNull();
    });

    it('should return 404 for non-existent recording', async () => {
      const response = await request(server.server)
        .delete('/v1/recordings/non_existent_id')
        .set('X-Danger-Dev-Server', 'true')
        .expect(404);

      expect(response.body.message).toContain('Recording not found');
    });
  });

  describe('Stream Recording', () => {
    beforeEach(async () => {
      await db.addRecording({
        id: 'recording_to_stream',
        key: 'recordings/recording_to_stream.m4a',
        title: 'Recording to Stream',
        durationSec: 90,
        createdAt: '2024-01-01T16:00:00.000Z'
      });
    });

    it('should redirect to signed URL for streaming', async () => {
      const response = await request(server.server)
        .get('/v1/recordings/recording_to_stream/stream')
        .set('X-Danger-Dev-Server', 'true')
        .expect(302);

      expect(response.headers.location).toMatch(/^https?:\/\/.+/);
    });

    it('should return 404 for non-existent recording stream', async () => {
      const response = await request(server.server)
        .get('/v1/recordings/non_existent_stream/stream')
        .set('X-Danger-Dev-Server', 'true')
        .expect(404);

      expect(response.body.message).toContain('Recording not found');
    });
  });

  describe('Dev Server Security Gate', () => {
    it('should require X-Danger-Dev-Server header for POST requests', async () => {
      const presignRequest = {
        id: 'test_recording_sec',
        contentType: 'audio/m4a',
        sizeBytes: 1024000
      };

      const response = await request(server.server)
        .post('/v1/uploads/presign')
        // Omit X-Danger-Dev-Server header
        .send(presignRequest)
        .expect(403);

      expect(response.body.message).toContain('Development server requires X-Danger-Dev-Server header');
    });

    it('should allow GET requests without special header', async () => {
      await request(server.server)
        .get('/v1/health/ping')
        // No special header required for GET
        .expect(200);
    });
  });
});