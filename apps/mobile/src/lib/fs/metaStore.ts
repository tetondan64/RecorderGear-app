import * as FileSystem from 'expo-file-system';

/**
 * MetaStore manages JSON persistence for folders and tags in the meta/ directory
 * Provides atomic writes and initialization for metadata files
 */

const META_DIR = `${FileSystem.documentDirectory}meta/`;
const FOLDERS_FILE = `${META_DIR}folders.json`;
const TAGS_FILE = `${META_DIR}tags.json`;

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = root folder
}

export interface Tag {
  id: string;
  name: string;
}

async function ensureMetaDirectory(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(META_DIR);
    if (!dirInfo.exists) {
      console.log('METASTORE: Creating meta directory');
      await FileSystem.makeDirectoryAsync(META_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('METASTORE: Failed to ensure meta directory:', error);
    throw new Error('Failed to initialize meta directory');
  }
}

async function atomicWrite(filePath: string, data: any): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  
  try {
    // Write to temporary file first
    await FileSystem.writeAsStringAsync(tempPath, JSON.stringify(data, null, 2));
    
    // Atomic rename to final location
    await FileSystem.moveAsync({
      from: tempPath,
      to: filePath,
    });
    
    console.log('METASTORE: Atomic write successful for', filePath);
  } catch (error) {
    // Cleanup temp file if it exists
    try {
      const tempInfo = await FileSystem.getInfoAsync(tempPath);
      if (tempInfo.exists) {
        await FileSystem.deleteAsync(tempPath);
      }
    } catch (cleanupError) {
      console.warn('METASTORE: Failed to cleanup temp file:', cleanupError);
    }
    
    console.error('METASTORE: Atomic write failed for', filePath, error);
    throw error;
  }
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      console.log('METASTORE: File does not exist, returning default:', filePath);
      return defaultValue;
    }

    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    console.log('METASTORE: Read file successfully:', filePath, `(${parsed.length || Object.keys(parsed).length} items)`);
    return parsed;
  } catch (error) {
    console.error('METASTORE: Failed to read file:', filePath, error);
    return defaultValue;
  }
}

export const MetaStore = {
  async initialize(): Promise<void> {
    await ensureMetaDirectory();
    
    // Create default files if they don't exist
    const [folders, tags] = await Promise.all([
      this.readFolders(),
      this.readTags(),
    ]);

    if (folders.length === 0) {
      await this.writeFolders([]);
    }
    if (tags.length === 0) {
      await this.writeTags([]);
    }
    
    console.log('METASTORE: Initialization complete');
  },

  async readFolders(): Promise<Folder[]> {
    return readJsonFile<Folder[]>(FOLDERS_FILE, []);
  },

  async writeFolders(folders: Folder[]): Promise<void> {
    await atomicWrite(FOLDERS_FILE, folders);
  },

  async readTags(): Promise<Tag[]> {
    return readJsonFile<Tag[]>(TAGS_FILE, []);
  },

  async writeTags(tags: Tag[]): Promise<void> {
    await atomicWrite(TAGS_FILE, tags);
  },

  // Utility methods for path management
  getMetaDir(): string {
    return META_DIR;
  },

  getFoldersPath(): string {
    return FOLDERS_FILE;
  },

  getTagsPath(): string {
    return TAGS_FILE;
  },
};