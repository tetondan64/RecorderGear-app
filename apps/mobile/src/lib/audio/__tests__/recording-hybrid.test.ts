import { renderHook, act } from '@testing-library/react-native';
import { useHybridRecorderManager } from '../recording-hybrid';

// Mock both recording modules
jest.mock('../recording-new', () => ({
  useAudioRecorderManager: jest.fn(() => ({
    startRecording: jest.fn().mockRejectedValue(new Error('expo-audio failed')),
    stopRecording: jest.fn(),
    dispose: jest.fn(),
    isRecording: false,
    duration: 0,
  })),
}));

jest.mock('../recording-fallback', () => ({
  useExpoAvRecorderManager: jest.fn(() => ({
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue({
      id: '123',
      fileUri: '/test/path.m4a',
      title: 'Test Recording',
      durationSec: 30,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    }),
    dispose: jest.fn(),
    isRecording: true,
    duration: 30,
  })),
}));

describe('useHybridRecorderManager', () => {
  const mockOnStateChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with expo-audio as default recorder type', () => {
    const { result } = renderHook(() => useHybridRecorderManager(mockOnStateChange));
    
    expect(result.current.recorderType).toBe('expo-audio');
    expect(result.current.isRecording).toBe(false);
    expect(result.current.duration).toBe(0);
  });

  it('should fallback to expo-av when expo-audio fails', async () => {
    const { result } = renderHook(() => useHybridRecorderManager(mockOnStateChange));
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    // Should have switched to expo-av after expo-audio failure
    expect(result.current.recorderType).toBe('expo-av');
  });

  it('should provide startRecording, stopRecording, and dispose methods', () => {
    const { result } = renderHook(() => useHybridRecorderManager(mockOnStateChange));
    
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
    expect(typeof result.current.dispose).toBe('function');
  });

  it('should handle stopRecording correctly', async () => {
    const { result } = renderHook(() => useHybridRecorderManager(mockOnStateChange));
    
    // First start recording to trigger fallback
    await act(async () => {
      await result.current.startRecording();
    });
    
    let recordingResult;
    await act(async () => {
      recordingResult = await result.current.stopRecording();
    });
    
    expect(recordingResult).toBeDefined();
    expect(recordingResult).toMatchObject({
      id: '123',
      fileUri: '/test/path.m4a',
      title: 'Test Recording',
      durationSec: 30,
    });
  });
});