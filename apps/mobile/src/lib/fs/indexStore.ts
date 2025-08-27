import * as FileSystem from 'expo-file-system';
import { INDEX_FILE_PATH, ensureRecordingsDirectory, getRecordingPath } from './paths';

export interface RecordingEntry {
  id: string;
  fileUri: string;
  title: string;
  durationSec: number;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  tags: string[]; // tag ids
}

export class IndexStore {
  private static async readIndex(): Promise<RecordingEntry[]> {
    try {
      const indexInfo = await FileSystem.getInfoAsync(INDEX_FILE_PATH);
      if (!indexInfo.exists) {
        return [];
      }
      
      const indexContent = await FileSystem.readAsStringAsync(INDEX_FILE_PATH);
      const entries = JSON.parse(indexContent);
      
      // Migrate entries to include folderId and tags if missing
      return await this.migrateEntries(entries);
    } catch (error) {
      console.error('Failed to read index:', error);
      return [];
    }
  }

  private static async migrateEntries(entries: any[]): Promise<RecordingEntry[]> {
    let hasChanges = false;
    
    const migratedEntries = entries.map(entry => {
      const migrated = { ...entry };
      
      // Add folderId if missing
      if (migrated.folderId === undefined) {
        migrated.folderId = null;
        hasChanges = true;
      }
      
      // Add tags if missing
      if (!Array.isArray(migrated.tags)) {
        migrated.tags = [];
        hasChanges = true;
      }
      
      return migrated as RecordingEntry;
    });
    
    // Persist changes if migration occurred
    if (hasChanges) {
      console.log('INDEXSTORE: Migration applied - adding folderId and tags to legacy recordings');
      await this.writeIndex(migratedEntries);
    }
    
    return migratedEntries;
  }

  private static async writeIndex(entries: RecordingEntry[]): Promise<void> {
    await ensureRecordingsDirectory();
    await FileSystem.writeAsStringAsync(INDEX_FILE_PATH, JSON.stringify(entries, null, 2));
  }

  static async getAllRecordings(): Promise<RecordingEntry[]> {
    return this.readIndex();
  }

  static async addRecording(entry: RecordingEntry): Promise<void> {
    const entries = await this.readIndex();
    entries.unshift(entry); // Add to beginning for chronological order
    await this.writeIndex(entries);
  }

  static async updateRecording(id: string, updates: Partial<RecordingEntry>): Promise<void> {
    const entries = await this.readIndex();
    const index = entries.findIndex(e => e.id === id);
    if (index >= 0) {
      entries[index] = { ...entries[index], ...updates, updatedAt: new Date().toISOString() };
      await this.writeIndex(entries);
    }
  }

  static async deleteRecording(id: string): Promise<void> {
    const entries = await this.readIndex();
    const filteredEntries = entries.filter(e => e.id !== id);
    
    // Delete the audio file
    const filePath = getRecordingPath(id);
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete recording file:', error);
    }
    
    await this.writeIndex(filteredEntries);
  }

  static async getRecording(id: string): Promise<RecordingEntry | null> {
    const entries = await this.readIndex();
    return entries.find(e => e.id === id) || null;
  }
}