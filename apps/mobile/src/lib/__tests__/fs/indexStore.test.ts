import * as FileSystem from 'expo-file-system';
import { IndexStore, RecordingEntry } from '../../fs/indexStore';

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('../../fs/paths', () => ({
  INDEX_FILE_PATH: 'file:///mock/recordings/index.json',
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('IndexStore', () => {
  const mockRecording: RecordingEntry = {
    id: '1',
    fileUri: 'file:///recordings/test1.m4a',
    title: 'Test Recording 1',
    durationSec: 60,
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
  };

  const mockRecordings: RecordingEntry[] = [
    mockRecording,
    {
      id: '2',
      fileUri: 'file:///recordings/test2.m4a',
      title: 'Test Recording 2',
      durationSec: 120,
      createdAt: '2024-01-01T13:00:00.000Z',
      updatedAt: '2024-01-01T13:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllRecordings', () => {
    it('should return recordings when index file exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));

      const result = await IndexStore.getAllRecordings();

      expect(result).toEqual(mockRecordings);
      expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///mock/recordings/index.json');
    });

    it('should return empty array when index file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const result = await IndexStore.getAllRecordings();

      expect(result).toEqual([]);
    });

    it('should return empty array when index file is invalid JSON', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue('invalid json');

      const result = await IndexStore.getAllRecordings();

      expect(result).toEqual([]);
    });

    it('should handle read errors gracefully', async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error('Access denied'));

      const result = await IndexStore.getAllRecordings();

      expect(result).toEqual([]);
    });

    it('should sort recordings by creation date (newest first)', async () => {
      const unsortedRecordings = [
        {
          ...mockRecording,
          createdAt: '2024-01-01T10:00:00.000Z',
        },
        {
          ...mockRecording,
          id: '2',
          createdAt: '2024-01-01T12:00:00.000Z',
        },
        {
          ...mockRecording,
          id: '3',
          createdAt: '2024-01-01T11:00:00.000Z',
        },
      ];

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(unsortedRecordings));

      const result = await IndexStore.getAllRecordings();

      expect(result[0].createdAt).toBe('2024-01-01T12:00:00.000Z');
      expect(result[1].createdAt).toBe('2024-01-01T11:00:00.000Z');
      expect(result[2].createdAt).toBe('2024-01-01T10:00:00.000Z');
    });
  });

  describe('addRecording', () => {
    it('should add recording to existing index', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify([mockRecordings[0]]));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      await IndexStore.addRecording(mockRecordings[1]);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/recordings/index.json',
        JSON.stringify([mockRecordings[1], mockRecordings[0]], null, 2)
      );
    });

    it('should create new index if none exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      await IndexStore.addRecording(mockRecording);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/recordings/index.json',
        JSON.stringify([mockRecording], null, 2)
      );
    });

    it('should handle write errors', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      mockFileSystem.writeAsStringAsync.mockRejectedValue(new Error('Write failed'));

      await expect(IndexStore.addRecording(mockRecording)).rejects.toThrow('Write failed');
    });
  });

  describe('updateRecording', () => {
    it('should update existing recording', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();

      const updates = { title: 'Updated Title' };
      await IndexStore.updateRecording('1', updates);

      const expectedRecordings = [
        { ...mockRecordings[0], ...updates, updatedAt: expect.any(String) },
        mockRecordings[1],
      ];

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/recordings/index.json',
        JSON.stringify(expectedRecordings, null, 2)
      );
    });

    it('should throw error if recording not found', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));

      await expect(IndexStore.updateRecording('nonexistent', { title: 'New Title' }))
        .rejects.toThrow('Recording not found');
    });

    it('should handle case when index does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      await expect(IndexStore.updateRecording('1', { title: 'New Title' }))
        .rejects.toThrow('Recording not found');
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording from index and file system', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockResolvedValue();

      await IndexStore.deleteRecording('1');

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith('file:///recordings/test1.m4a');
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/recordings/index.json',
        JSON.stringify([mockRecordings[1]], null, 2)
      );
    });

    it('should handle file deletion errors gracefully', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));
      mockFileSystem.writeAsStringAsync.mockResolvedValue();
      mockFileSystem.deleteAsync.mockRejectedValue(new Error('File not found'));

      // Should not throw, but should still update index
      await expect(IndexStore.deleteRecording('1')).resolves.not.toThrow();

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/recordings/index.json',
        JSON.stringify([mockRecordings[1]], null, 2)
      );
    });

    it('should throw error if recording not found', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockRecordings));

      await expect(IndexStore.deleteRecording('nonexistent'))
        .rejects.toThrow('Recording not found');
    });

    it('should handle case when index does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      await expect(IndexStore.deleteRecording('1'))
        .rejects.toThrow('Recording not found');
    });
  });
});