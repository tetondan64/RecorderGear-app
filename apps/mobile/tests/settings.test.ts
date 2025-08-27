import * as FileSystem from 'expo-file-system';
import { SettingsStore, DEFAULT_SEARCH_SETTINGS } from '../src/lib/fs/settingsStore';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('SettingsStore', () => {
  const mockSettings = {
    query: 'test query',
    recent: ['search1', 'search2'],
    sortBy: 'DURATION' as const,
    sortDir: 'ASC' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should create settings directory if it does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false, isDirectory: false });
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await SettingsStore.initialize();

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalled();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('settings'),
        { intermediates: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true });

      await SettingsStore.initialize();

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalled();
      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('readSearchSettings', () => {
    it('should return default settings when file does not exist', async () => {
      mockFileSystem.readAsStringAsync.mockRejectedValue(new Error('File not found'));

      const settings = await SettingsStore.readSearchSettings();

      expect(settings).toEqual(DEFAULT_SEARCH_SETTINGS);
    });

    it('should return parsed settings when file exists', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockSettings));

      const settings = await SettingsStore.readSearchSettings();

      expect(settings).toEqual(mockSettings);
    });

    it('should return default settings when JSON is invalid', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue('invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const settings = await SettingsStore.readSearchSettings();

      expect(settings).toEqual(DEFAULT_SEARCH_SETTINGS);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read search settings:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should merge with defaults for partial settings', async () => {
      const partialSettings = { query: 'partial query' };
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(partialSettings));

      const settings = await SettingsStore.readSearchSettings();

      expect(settings).toEqual({
        ...DEFAULT_SEARCH_SETTINGS,
        ...partialSettings,
      });
    });
  });

  describe('writeSearchSettings', () => {
    it('should write settings to file immediately when not debouncing', async () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      await SettingsStore.writeSearchSettings(mockSettings);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('search.json'),
        JSON.stringify(mockSettings, null, 2)
      );
    });

    it('should debounce multiple rapid writes', async () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      // Make multiple rapid writes
      SettingsStore.writeSearchSettings(mockSettings);
      SettingsStore.writeSearchSettings({ ...mockSettings, query: 'updated' });
      SettingsStore.writeSearchSettings({ ...mockSettings, query: 'final' });

      // Should not write immediately
      expect(mockFileSystem.writeAsStringAsync).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      jest.advanceTimersByTime(300);

      // Should write only the latest value
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('search.json'),
        JSON.stringify({ ...mockSettings, query: 'final' }, null, 2)
      );
    });

    it('should handle write errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFileSystem.writeAsStringAsync.mockRejectedValue(new Error('Write failed'));

      await SettingsStore.writeSearchSettings(mockSettings);
      jest.advanceTimersByTime(300);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write search settings:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('atomic writes', () => {
    it('should handle concurrent reads during writes', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockSettings));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      // Start a read and write concurrently
      const readPromise = SettingsStore.readSearchSettings();
      const writePromise = SettingsStore.writeSearchSettings({ ...mockSettings, query: 'new' });

      const [readResult] = await Promise.all([readPromise, writePromise]);

      // Read should still work during write
      expect(readResult).toEqual(mockSettings);
    });

    it('should maintain data integrity during multiple writes', async () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      const updates = [
        { ...mockSettings, query: 'update1' },
        { ...mockSettings, query: 'update2' },
        { ...mockSettings, query: 'update3' },
      ];

      // Fire off multiple writes
      updates.forEach(update => SettingsStore.writeSearchSettings(update));

      jest.advanceTimersByTime(300);

      // Should only write once with the latest data
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('search.json'),
        JSON.stringify(updates[2], null, 2)
      );
    });
  });

  describe('performance', () => {
    it('should complete read operations within performance budget', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockSettings));
      
      const startTime = performance.now();
      await SettingsStore.readSearchSettings();
      const endTime = performance.now();

      // Should be much faster than 40ms (search latency budget)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should debounce writes efficiently', () => {
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      // Make many rapid writes
      for (let i = 0; i < 100; i++) {
        SettingsStore.writeSearchSettings({ ...mockSettings, query: `query${i}` });
      }

      // Should not have written yet
      expect(mockFileSystem.writeAsStringAsync).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      // Should only write once
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    });
  });
});