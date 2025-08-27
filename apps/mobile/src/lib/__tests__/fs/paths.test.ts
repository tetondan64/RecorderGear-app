import * as FileSystem from 'expo-file-system';
import { getRecordingPath, ensureRecordingsDirectory, RECORDINGS_DIR } from '../../fs/paths';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecordingPath', () => {
    it('should return correct path for recording ID', () => {
      const id = '1234567890';
      const expectedPath = `${RECORDINGS_DIR}${id}.m4a`;
      
      const result = getRecordingPath(id);
      
      expect(result).toBe(expectedPath);
      expect(result).toContain('recordings/1234567890.m4a');
    });

    it('should handle different ID formats', () => {
      expect(getRecordingPath('abc123')).toContain('abc123.m4a');
      expect(getRecordingPath('test-recording')).toContain('test-recording.m4a');
      expect(getRecordingPath('123')).toContain('123.m4a');
    });
  });

  describe('ensureRecordingsDirectory', () => {
    it('should not create directory if it already exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
      });

      await ensureRecordingsDirectory();

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(RECORDINGS_DIR);
      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
      });
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await ensureRecordingsDirectory();

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(RECORDINGS_DIR);
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        RECORDINGS_DIR,
        { intermediates: true }
      );
    });

    it('should create directory if existing path is not a directory', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
      });
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await ensureRecordingsDirectory();

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        RECORDINGS_DIR,
        { intermediates: true }
      );
    });

    it('should handle getInfoAsync errors', async () => {
      mockFileSystem.getInfoAsync.mockRejectedValue(new Error('Access denied'));
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await ensureRecordingsDirectory();

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        RECORDINGS_DIR,
        { intermediates: true }
      );
    });

    it('should handle makeDirectoryAsync errors', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
      });
      mockFileSystem.makeDirectoryAsync.mockRejectedValue(new Error('Permission denied'));

      await expect(ensureRecordingsDirectory()).rejects.toThrow('Permission denied');
    });
  });

  describe('constants', () => {
    it('should have correct RECORDINGS_DIR path', () => {
      expect(RECORDINGS_DIR).toBe('file:///mock/documents/recordings/');
      expect(RECORDINGS_DIR).toContain('recordings/');
      expect(RECORDINGS_DIR.endsWith('/')).toBe(true);
    });
  });
});