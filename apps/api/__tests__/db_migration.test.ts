import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db, checkDatabaseHealth } from '../src/db/client';
import { recordings, folders, tags, recordingTags, recordingFolders } from '../src/db/schema';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config();

describe('Database Migration Tests', () => {
  let testPool: Pool;
  let testDb: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Create test database connection
    const connectionString = process.env.DATABASE_URL || 'postgresql://recordergear:devpass@localhost:5432/recordergear';
    testPool = new Pool({ 
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    testDb = drizzle(testPool);
  });

  afterAll(async () => {
    await testPool.end();
  });

  describe('Database Connection', () => {
    it('should connect to PostgreSQL database', async () => {
      const result = await testPool.query('SELECT 1 as connected');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].connected).toBe(1);
    });

    it('should pass health check', async () => {
      const isHealthy = await checkDatabaseHealth();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    it('should have users table with correct structure', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(3);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        id: { type: 'uuid', nullable: false },
        email: { type: 'text', nullable: true },
        created_at: { type: 'timestamp with time zone', nullable: false }
      });
    });

    it('should have recordings table with correct structure', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'recordings' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(7);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        id: { type: 'text', nullable: false },
        user_id: { type: 'uuid', nullable: true },
        title: { type: 'text', nullable: false },
        duration_sec: { type: 'integer', nullable: false },
        s3_key: { type: 'text', nullable: false },
        created_at: { type: 'timestamp with time zone', nullable: false },
        updated_at: { type: 'timestamp with time zone', nullable: false }
      });
    });

    it('should have folders table with correct structure', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'folders' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(5);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        id: { type: 'uuid', nullable: false },
        user_id: { type: 'uuid', nullable: true },
        name: { type: 'text', nullable: false },
        parent_id: { type: 'uuid', nullable: true },
        created_at: { type: 'timestamp with time zone', nullable: false }
      });
    });

    it('should have tags table with correct structure', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'tags' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(4);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        id: { type: 'uuid', nullable: false },
        user_id: { type: 'uuid', nullable: true },
        name: { type: 'text', nullable: false },
        created_at: { type: 'timestamp with time zone', nullable: false }
      });
    });

    it('should have recording_tags junction table', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'recording_tags' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(2);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        recording_id: { type: 'text', nullable: false },
        tag_id: { type: 'uuid', nullable: false }
      });
    });

    it('should have recording_folders junction table', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'recording_folders' AND table_schema = 'public'
        ORDER BY column_name;
      `);

      expect(result.rows).toHaveLength(3);
      
      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
        return acc;
      }, {});

      expect(columns).toMatchObject({
        recording_id: { type: 'text', nullable: false },
        folder_id: { type: 'uuid', nullable: false },
        created_at: { type: 'timestamp with time zone', nullable: false }
      });
    });
  });

  describe('Constraints and Indexes', () => {
    it('should have primary keys on all main tables', async () => {
      const result = await testPool.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_schema = 'public'
          AND tc.table_name IN ('users', 'recordings', 'folders', 'tags')
        ORDER BY tc.table_name, kcu.column_name;
      `);

      expect(result.rows).toEqual([
        { table_name: 'folders', column_name: 'id' },
        { table_name: 'recordings', column_name: 'id' },
        { table_name: 'tags', column_name: 'id' },
        { table_name: 'users', column_name: 'id' }
      ]);
    });

    it('should have foreign key constraints', async () => {
      const result = await testPool.query(`
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `);

      expect(result.rows.length).toBeGreaterThan(5); // Should have multiple FK constraints
      
      // Verify specific foreign keys exist
      const fkMap = result.rows.reduce((acc, row) => {
        const key = `${row.table_name}.${row.column_name}`;
        acc[key] = row.foreign_table;
        return acc;
      }, {});

      expect(fkMap).toMatchObject({
        'recordings.user_id': 'users',
        'folders.user_id': 'users',
        'tags.user_id': 'users',
        'recording_tags.recording_id': 'recordings',
        'recording_tags.tag_id': 'tags',
        'recording_folders.recording_id': 'recordings',
        'recording_folders.folder_id': 'folders'
      });
    });

    it('should have required indexes for performance', async () => {
      const result = await testPool.query(`
        SELECT schemaname, tablename, indexname, indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('recordings', 'folders', 'tags', 'recording_tags', 'recording_folders')
        ORDER BY tablename, indexname;
      `);

      expect(result.rows.length).toBeGreaterThan(8); // Should have multiple indexes
      
      const indexes = result.rows.map(row => row.indexname);
      
      // Check for specific performance indexes
      expect(indexes.some(idx => idx.includes('recordings_user_created_at'))).toBe(true);
      expect(indexes.some(idx => idx.includes('recording_tags_tag'))).toBe(true);
      expect(indexes.some(idx => idx.includes('recording_folders_folder'))).toBe(true);
    });

    it('should have unique constraints where required', async () => {
      const result = await testPool.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `);

      expect(result.rows.length).toBeGreaterThan(2); // Should have unique constraints
      
      const uniqueConstraints = result.rows.map(row => `${row.table_name}.${row.column_name}`);
      expect(uniqueConstraints).toContain('users.email');
    });
  });

  describe('Data Operations', () => {
    beforeEach(async () => {
      // Clean up test data
      await testDb.delete(recordingTags);
      await testDb.delete(recordingFolders);
      await testDb.delete(recordings);
      await testDb.delete(tags);
      await testDb.delete(folders);
    });

    it('should insert and retrieve basic data', async () => {
      // Insert a test recording
      const insertedRecordings = await testDb
        .insert(recordings)
        .values({
          id: 'test_migration_001',
          title: 'Migration Test Recording',
          durationSec: 120,
          s3Key: 'recordings/test_migration_001.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      expect(insertedRecordings).toHaveLength(1);
      const recording = insertedRecordings[0];
      expect(recording.id).toBe('test_migration_001');
      expect(recording.title).toBe('Migration Test Recording');

      // Retrieve the recording
      const [retrieved] = await testDb
        .select()
        .from(recordings)
        .where(sql`${recordings.id} = ${recording.id}`)
        .limit(1);

      expect(retrieved).toMatchObject({
        id: 'test_migration_001',
        title: 'Migration Test Recording',
        durationSec: 120,
        s3Key: 'recordings/test_migration_001.m4a'
      });
    });

    it('should handle cascading deletes properly', async () => {
      // Create a folder with recording
      const insertedFolders = await testDb
        .insert(folders)
        .values({
          name: 'Test Folder',
          userId: null,
        })
        .returning();
      
      expect(insertedFolders).toHaveLength(1);
      const folder = insertedFolders[0];

      const insertedRecordings = await testDb
        .insert(recordings)
        .values({
          id: 'cascade_test_001',
          title: 'Cascade Test',
          durationSec: 60,
          s3Key: 'recordings/cascade_test_001.m4a',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      expect(insertedRecordings).toHaveLength(1);
      const recording = insertedRecordings[0];

      await testDb
        .insert(recordingFolders)
        .values({
          recordingId: recording.id,
          folderId: folder.id,
        });

      // Delete the recording - should cascade to recording_folders
      await testDb
        .delete(recordings)
        .where(sql`${recordings.id} = ${recording.id}`);

      // Verify recording_folders entry was deleted
      const remainingRelations = await testDb
        .select()
        .from(recordingFolders)
        .where(sql`${recordingFolders.recordingId} = ${recording.id}`);

      expect(remainingRelations).toHaveLength(0);
    });
  });
});