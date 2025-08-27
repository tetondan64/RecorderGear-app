import { renderHook, act } from '@testing-library/react-native';
import { useRecordings } from '../../store/recordings';
import { IndexStore, RecordingEntry } from '../../fs/indexStore';

jest.mock('../../fs/indexStore', () => ({
  IndexStore: {
    getAllRecordings: jest.fn(),
    addRecording: jest.fn(),
    updateRecording: jest.fn(),
    deleteRecording: jest.fn(),
  },
}));

const mockIndexStore = IndexStore as jest.Mocked<typeof IndexStore>;

describe('useRecordings', () => {
  const mockRecording: RecordingEntry = {
    id: '1',
    fileUri: 'file:///recordings/test.m4a',
    title: 'Test Recording',
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

  describe('initial state and loading', () => {
    it('should start with loading state', () => {
      mockIndexStore.getAllRecordings.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useRecordings());

      expect(result.current.loading).toBe(true);
      expect(result.current.recordings).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should load recordings on mount', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        // Wait for the effect to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.recordings).toEqual(mockRecordings);
      expect(result.current.error).toBeUndefined();
    });

    it('should handle loading errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockIndexStore.getAllRecordings.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.recordings).toEqual([]);
      expect(result.current.error).toBe('Failed to load recordings');
      expect(consoleError).toHaveBeenCalledWith('Failed to load recordings:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('refresh', () => {
    it('should reload recordings', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Clear the mock to test refresh
      mockIndexStore.getAllRecordings.mockClear();
      mockIndexStore.getAllRecordings.mockResolvedValue([mockRecording]);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockIndexStore.getAllRecordings).toHaveBeenCalledTimes(1);
      expect(result.current.recordings).toEqual([mockRecording]);
    });

    it('should handle refresh errors', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      mockIndexStore.getAllRecordings.mockRejectedValue(new Error('Refresh failed'));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Failed to load recordings');
      expect(consoleError).toHaveBeenCalledWith('Failed to load recordings:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('addRecording', () => {
    it('should add recording successfully', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue([]);
      mockIndexStore.addRecording.mockResolvedValue();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.addRecording(mockRecording);
      });

      expect(mockIndexStore.addRecording).toHaveBeenCalledWith(mockRecording);
      expect(result.current.recordings).toEqual([mockRecording]);
    });

    it('should add recording to existing list', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue([mockRecordings[1]]);
      mockIndexStore.addRecording.mockResolvedValue();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.addRecording(mockRecordings[0]);
      });

      expect(result.current.recordings).toEqual([mockRecordings[0], mockRecordings[1]]);
    });

    it('should handle add recording errors', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue([]);
      mockIndexStore.addRecording.mockRejectedValue(new Error('Add failed'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.addRecording(mockRecording);
        })
      ).rejects.toThrow('Failed to save recording');

      expect(consoleError).toHaveBeenCalledWith('Failed to add recording:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('updateRecording', () => {
    it('should update recording successfully', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);
      mockIndexStore.updateRecording.mockResolvedValue();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const updates = { title: 'Updated Title' };

      await act(async () => {
        await result.current.updateRecording('1', updates);
      });

      expect(mockIndexStore.updateRecording).toHaveBeenCalledWith('1', updates);
      expect(result.current.recordings[0].title).toBe('Updated Title');
      expect(result.current.recordings[0].updatedAt).toBeDefined();
    });

    it('should handle update recording errors', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);
      mockIndexStore.updateRecording.mockRejectedValue(new Error('Update failed'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.updateRecording('1', { title: 'New Title' });
        })
      ).rejects.toThrow('Failed to update recording');

      expect(consoleError).toHaveBeenCalledWith('Failed to update recording:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording successfully', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);
      mockIndexStore.deleteRecording.mockResolvedValue();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.deleteRecording('1');
      });

      expect(mockIndexStore.deleteRecording).toHaveBeenCalledWith('1');
      expect(result.current.recordings).toHaveLength(1);
      expect(result.current.recordings[0].id).toBe('2');
    });

    it('should handle delete recording errors', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);
      mockIndexStore.deleteRecording.mockRejectedValue(new Error('Delete failed'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.deleteRecording('1');
        })
      ).rejects.toThrow('Failed to delete recording');

      expect(consoleError).toHaveBeenCalledWith('Failed to delete recording:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('getRecording', () => {
    it('should return recording by id', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const recording = result.current.getRecording('1');
      expect(recording).toEqual(mockRecording);
    });

    it('should return undefined for non-existent recording', async () => {
      mockIndexStore.getAllRecordings.mockResolvedValue(mockRecordings);

      const { result } = renderHook(() => useRecordings());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const recording = result.current.getRecording('nonexistent');
      expect(recording).toBeUndefined();
    });
  });
});