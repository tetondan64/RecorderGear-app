import { promises as fs } from 'fs';
import { join } from 'path';
import type { RecordingMetadata, DatabaseState } from '../types';

const DB_FILE = join(__dirname, '../../storage/db.json');

/**
 * Simple JSON database with atomic writes
 * In production, this would be replaced with a real database
 */
class JsonDatabase {
  private cache: DatabaseState | null = null;
  private writing = false;

  async initialize(): Promise<void> {
    try {
      await this.ensureStorageDir();
      await this.load();
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  private async ensureStorageDir(): Promise<void> {
    const storageDir = join(__dirname, '../../storage');
    try {
      await fs.access(storageDir);
    } catch {
      await fs.mkdir(storageDir, { recursive: true });
    }
  }

  private async load(): Promise<DatabaseState> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(DB_FILE, 'utf-8');
      this.cache = JSON.parse(data);
      return this.cache!;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create empty database
        this.cache = { recordings: [] };
        await this.save();
        return this.cache;
      }
      throw error;
    }
  }

  private async save(): Promise<void> {
    if (this.writing || !this.cache) {
      return;
    }

    this.writing = true;
    try {
      const tempFile = `${DB_FILE}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(this.cache, null, 2));
      await fs.rename(tempFile, DB_FILE);
    } finally {
      this.writing = false;
    }
  }

  async getAllRecordings(): Promise<RecordingMetadata[]> {
    const state = await this.load();
    return [...state.recordings];
  }

  async getRecording(id: string): Promise<RecordingMetadata | null> {
    const state = await this.load();
    return state.recordings.find(r => r.id === id) ?? null;
  }

  async addRecording(recording: RecordingMetadata): Promise<void> {
    const state = await this.load();
    
    // Check for duplicate ID (finalize should be idempotent)
    const existingIndex = state.recordings.findIndex(r => r.id === recording.id);
    if (existingIndex >= 0) {
      // Update existing (idempotent finalize)
      state.recordings[existingIndex] = recording;
    } else {
      // Add new recording
      state.recordings.push(recording);
    }
    
    this.cache = state;
    await this.save();
  }

  async deleteRecording(id: string): Promise<boolean> {
    const state = await this.load();
    const initialCount = state.recordings.length;
    state.recordings = state.recordings.filter(r => r.id !== id);
    
    if (state.recordings.length < initialCount) {
      this.cache = state;
      await this.save();
      return true;
    }
    return false;
  }

  async recordingExists(id: string): Promise<boolean> {
    const recording = await this.getRecording(id);
    return recording !== null;
  }

  async findByKey(key: string): Promise<RecordingMetadata | null> {
    const state = await this.load();
    return state.recordings.find(r => r.key === key) ?? null;
  }
}

// Singleton instance
export const db = new JsonDatabase();