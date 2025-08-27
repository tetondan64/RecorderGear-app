import * as FileSystem from 'expo-file-system';

/**
 * SettingsStore manages JSON persistence for search and sort preferences
 * Provides atomic writes and debounced saves for user settings
 */

const META_DIR = `${FileSystem.documentDirectory}meta/`;
const SETTINGS_FILE = `${META_DIR}settings.json`;

export type SortBy = 'CREATED_AT' | 'UPDATED_AT' | 'DURATION';
export type SortDir = 'ASC' | 'DESC';

export interface SearchSettings {
  query: string;
  recent: string[];
  sortBy: SortBy;
  sortDir: SortDir;
}

// Default settings
const DEFAULT_SETTINGS: SearchSettings = {
  query: '',
  recent: [],
  sortBy: 'CREATED_AT',
  sortDir: 'DESC',
};

let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 300;

async function ensureMetaDirectory(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(META_DIR);
    if (!dirInfo.exists) {
      console.log('SETTINGSSTORE: Creating meta directory');
      await FileSystem.makeDirectoryAsync(META_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('SETTINGSSTORE: Failed to ensure meta directory:', error);
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
    
    console.log('SETTINGSSTORE: Atomic write successful for', filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
    } catch {}
    
    console.error('SETTINGSSTORE: Atomic write failed:', error);
    throw error;
  }
}

async function readJSONFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    if (!fileInfo.exists) {
      console.log('SETTINGSSTORE: File does not exist, returning default:', filePath);
      return defaultValue;
    }
    
    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    
    console.log('SETTINGSSTORE: Read file successfully:', filePath, `(${Object.keys(parsed).length} keys)`);
    return parsed;
  } catch (error) {
    console.error('SETTINGSSTORE: Failed to read file, returning default:', error);
    return defaultValue;
  }
}

function debouncedSave(settings: SearchSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Set new timeout
    saveTimeout = setTimeout(async () => {
      try {
        await ensureMetaDirectory();
        await atomicWrite(SETTINGS_FILE, settings);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, SAVE_DEBOUNCE_MS);
  });
}

export const SettingsStore = {
  /**
   * Initialize the settings store - call once on app startup
   */
  async initialize(): Promise<void> {
    await ensureMetaDirectory();
    console.log('SETTINGSSTORE: Initialization complete');
  },

  /**
   * Read settings from storage
   */
  async readSettings(): Promise<SearchSettings> {
    try {
      const settings = await readJSONFile(SETTINGS_FILE, DEFAULT_SETTINGS);
      
      // Validate and migrate settings if needed
      return {
        query: typeof settings.query === 'string' ? settings.query : DEFAULT_SETTINGS.query,
        recent: Array.isArray(settings.recent) ? settings.recent.slice(0, 5) : DEFAULT_SETTINGS.recent,
        sortBy: ['CREATED_AT', 'UPDATED_AT', 'DURATION'].includes(settings.sortBy) ? settings.sortBy : DEFAULT_SETTINGS.sortBy,
        sortDir: ['ASC', 'DESC'].includes(settings.sortDir) ? settings.sortDir : DEFAULT_SETTINGS.sortDir,
      };
    } catch (error) {
      console.error('SETTINGSSTORE: Failed to read settings, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Write settings to storage with debouncing
   */
  async writeSettings(settings: SearchSettings): Promise<void> {
    try {
      await debouncedSave(settings);
    } catch (error) {
      console.error('SETTINGSSTORE: Failed to write settings:', error);
      throw error;
    }
  },

  /**
   * Write settings immediately (for app shutdown/critical saves)
   */
  async writeSettingsImmediate(settings: SearchSettings): Promise<void> {
    try {
      // Clear any pending debounced save
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      
      await ensureMetaDirectory();
      await atomicWrite(SETTINGS_FILE, settings);
    } catch (error) {
      console.error('SETTINGSSTORE: Failed to write settings immediately:', error);
      throw error;
    }
  },

  /**
   * Get default settings
   */
  getDefaultSettings(): SearchSettings {
    return { ...DEFAULT_SETTINGS };
  },
};