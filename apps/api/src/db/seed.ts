#!/usr/bin/env tsx

import { db, users, folders, tags, recordings, recordingTags, recordingFolders } from './client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Database seeding for development
 * Creates sample data for testing and development
 * 
 * Usage:
 *   npm run db:seed
 *   tsx src/db/seed.ts
 */

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create a dev user (optional, for future auth)
    const [devUser] = await db.insert(users).values({
      email: 'dev@recordergear.local',
    }).returning();

    console.log('👤 Created dev user:', devUser.email);

    // Create sample folders
    const [workFolder] = await db.insert(folders).values({
      name: 'Work',
      userId: devUser.id,
    }).returning();

    const [meetingsFolder] = await db.insert(folders).values({
      name: 'Meetings',
      parentId: workFolder.id,
      userId: devUser.id,
    }).returning();

    const [personalFolder] = await db.insert(folders).values({
      name: 'Personal',
      userId: devUser.id,
    }).returning();

    console.log('📁 Created sample folders: Work, Meetings, Personal');

    // Create sample tags
    const [importantTag] = await db.insert(tags).values({
      name: 'Important',
      userId: devUser.id,
    }).returning();

    const [todoTag] = await db.insert(tags).values({
      name: 'TODO',
      userId: devUser.id,
    }).returning();

    const [ideaTag] = await db.insert(tags).values({
      name: 'Idea',
      userId: devUser.id,
    }).returning();

    console.log('🏷️ Created sample tags: Important, TODO, Idea');

    // Create sample recordings
    const sampleRecordings = [
      {
        id: 'seed_recording_001',
        title: 'Team Standup Notes',
        durationSec: 180,
        s3Key: 'recordings/seed_recording_001.m4a',
        userId: devUser.id,
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:03:00Z'),
      },
      {
        id: 'seed_recording_002', 
        title: 'Project Brainstorm Session',
        durationSec: 1440, // 24 minutes
        s3Key: 'recordings/seed_recording_002.m4a',
        userId: devUser.id,
        createdAt: new Date('2024-01-16T14:30:00Z'),
        updatedAt: new Date('2024-01-16T14:54:00Z'),
      },
      {
        id: 'seed_recording_003',
        title: 'Personal Voice Memo',
        durationSec: 45,
        s3Key: 'recordings/seed_recording_003.m4a', 
        userId: devUser.id,
        createdAt: new Date('2024-01-17T18:15:00Z'),
        updatedAt: new Date('2024-01-17T18:16:00Z'),
      },
    ];

    const insertedRecordings = await db.insert(recordings).values(sampleRecordings).returning();
    console.log('🎙️ Created sample recordings:', insertedRecordings.length);

    // Assign recordings to folders
    await db.insert(recordingFolders).values([
      { recordingId: 'seed_recording_001', folderId: meetingsFolder.id },
      { recordingId: 'seed_recording_002', folderId: workFolder.id },
      { recordingId: 'seed_recording_003', folderId: personalFolder.id },
    ]);

    console.log('📂 Assigned recordings to folders');

    // Assign tags to recordings
    await db.insert(recordingTags).values([
      { recordingId: 'seed_recording_001', tagId: importantTag.id },
      { recordingId: 'seed_recording_002', tagId: importantTag.id },
      { recordingId: 'seed_recording_002', tagId: ideaTag.id },
      { recordingId: 'seed_recording_003', tagId: todoTag.id },
    ]);

    console.log('🏷️ Assigned tags to recordings');

    console.log('✅ Database seeding completed successfully');
    console.log(`
📊 Created:
  - 1 user (${devUser.email})
  - 3 folders (Work → Meetings, Personal)
  - 3 tags (Important, TODO, Idea)
  - 3 recordings with folder/tag assignments
    `);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
}