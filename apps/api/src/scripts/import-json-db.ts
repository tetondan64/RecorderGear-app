#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join } from 'path';
import { db, recordings } from '../db/client';
import type { RecordingMetadata } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * JSON Database Import Script
 * Migrates existing recording metadata from JSON storage to PostgreSQL
 * 
 * This script:
 * 1. Reads the legacy JSON database file (storage/db.json)
 * 2. Imports recording metadata into the new PostgreSQL recordings table
 * 3. Maps JSON fields to database columns appropriately
 * 4. Handles duplicate records gracefully (upsert behavior)
 * 
 * Usage:
 *   npm run db:import-json
 *   tsx src/scripts/import-json-db.ts
 */

interface LegacyDatabaseState {
  recordings: RecordingMetadata[];
}

const JSON_DB_PATH = join(__dirname, '../../storage/db.json');

async function importJsonDatabase() {
  console.log('📦 Starting JSON database import...');
  
  try {
    // Check if JSON database file exists
    try {
      await fs.access(JSON_DB_PATH);
    } catch {
      console.log('ℹ️  No JSON database file found at:', JSON_DB_PATH);
      console.log('ℹ️  Nothing to import. This is normal for new installations.');
      return;
    }

    console.log('📂 Reading JSON database from:', JSON_DB_PATH);
    
    // Read and parse JSON database
    const jsonContent = await fs.readFile(JSON_DB_PATH, 'utf-8');
    const legacyDb: LegacyDatabaseState = JSON.parse(jsonContent);
    
    console.log(`📊 Found ${legacyDb.recordings?.length || 0} recordings in JSON database`);
    
    if (!legacyDb.recordings || legacyDb.recordings.length === 0) {
      console.log('ℹ️  No recordings to import');
      return;
    }

    // Import recordings
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const recording of legacyDb.recordings) {
      try {
        // Validate required fields
        if (!recording.id || !recording.key || !recording.title || !recording.createdAt) {
          console.warn(`⚠️  Skipping invalid recording:`, recording);
          skippedCount++;
          continue;
        }

        // Map JSON fields to database schema
        const recordingData = {
          id: recording.id,
          userId: null, // No user association in legacy data
          title: recording.title,
          durationSec: recording.durationSec || 0,
          s3Key: recording.key, // JSON 'key' → DB 's3Key'
          createdAt: new Date(recording.createdAt),
          updatedAt: new Date(recording.updatedAt || recording.createdAt),
        };

        // Insert with conflict handling (upsert)
        await db
          .insert(recordings)
          .values(recordingData)
          .onConflictDoUpdate({
            target: recordings.id,
            set: {
              title: recordingData.title,
              durationSec: recordingData.durationSec,
              s3Key: recordingData.s3Key,
              updatedAt: recordingData.updatedAt,
            },
          });

        console.log(`✅ Imported: ${recording.id} (${recording.title})`);
        importedCount++;

      } catch (error) {
        console.error(`❌ Failed to import recording ${recording.id}:`, error);
        errorCount++;
      }
    }

    // Create backup of JSON file
    const backupPath = `${JSON_DB_PATH}.imported-${Date.now()}`;
    await fs.copyFile(JSON_DB_PATH, backupPath);
    console.log(`💾 Backed up JSON database to: ${backupPath}`);

    // Summary
    console.log(`
✅ JSON import completed!

📊 Summary:
  - Total recordings in JSON: ${legacyDb.recordings.length}
  - Successfully imported: ${importedCount}
  - Skipped (invalid): ${skippedCount}
  - Errors: ${errorCount}
  - JSON backup: ${backupPath}

💡 Notes:
  - Legacy JSON file has been backed up and preserved
  - Database now contains all imported recording metadata
  - S3 files remain unchanged and accessible
  - Folders/tags are empty (not present in legacy format)
    `);

  } catch (error) {
    console.error('❌ JSON database import failed:', error);
    throw error;
  }
}

// Helper function to validate timestamp
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

// Run import if this file is executed directly
if (require.main === module) {
  importJsonDatabase().catch((error) => {
    console.error('Import script failed:', error);
    process.exit(1);
  });
}

export { importJsonDatabase };