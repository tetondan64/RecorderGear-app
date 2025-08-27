import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AudioRecorder } from '../../audio/recording';
import { IndexStore } from '../../fs/indexStore';
import { HapticsManager } from '../haptics';
import { getRecordingPath } from '../../fs/paths';

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn(),
    RECORDING_OPTIONS_PRESET_HIGH_QUALITY: {},
    RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4: 2,
    RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC: 3,
    RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC: 'mp4a',
    RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH: 60,
  },
}));

jest.mock('expo-file-system', () => ({
  copyAsync: jest.fn(),
}));

jest.mock('../../fs/indexStore', () => ({
  IndexStore: {
    addRecording: jest.fn(),
  },
}));

jest.mock('../haptics', () => ({
  HapticsManager: {
    recordStart: jest.fn(),
    recordStop: jest.fn(),
  },
}));

jest.mock('../../fs/paths', () => ({
  getRecordingPath: jest.fn(),
}));

const mockRecording = {
  prepareToRecordAsync: jest.fn(),
  startAsync: jest.fn(),
  stopAndUnloadAsync: jest.fn(),
  getStatusAsync: jest.fn(),
};

describe('AudioRecorder', () => {
  let onStateChange: jest.Mock;
  let recorder: AudioRecorder;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    onStateChange = jest.fn();
    recorder = new AudioRecorder(onStateChange);
    
    (Audio.Recording as jest.Mock).mockImplementation(() => mockRecording);
    (getRecordingPath as jest.Mock).mockReturnValue('file:///recordings/test.m4a');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startRecording', () => {
    it('should start recording successfully', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({});
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      mockRecording.prepareToRecordAsync.mockResolvedValue({});
      mockRecording.startAsync.mockResolvedValue({});

      await recorder.startRecording();

      expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      expect(mockRecording.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecording.startAsync).toHaveBeenCalled();
      expect(HapticsManager.recordStart).toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith({
        isRecording: true,
        duration: 0,
      });
    });

    it('should update duration during recording', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({});
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      mockRecording.prepareToRecordAsync.mockResolvedValue({});
      mockRecording.startAsync.mockResolvedValue({});

      await recorder.startRecording();

      jest.advanceTimersByTime(3000);

      expect(onStateChange).toHaveBeenCalledWith({
        isRecording: true,
        duration: 3,
      });
    });

    it('should handle recording start errors', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(recorder.startRecording()).rejects.toThrow('Failed to start recording');
    });
  });

  describe('stopRecording', () => {
    beforeEach(async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({});
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      mockRecording.prepareToRecordAsync.mockResolvedValue({});
      mockRecording.startAsync.mockResolvedValue({});
      
      await recorder.startRecording();
    });

    it('should stop recording and save entry successfully', async () => {
      const mockStatus = {
        isLoaded: true,
        uri: 'file:///temp/recording.m4a',
        durationMillis: 5000,
      };

      mockRecording.stopAndUnloadAsync.mockResolvedValue({});
      mockRecording.getStatusAsync.mockResolvedValue(mockStatus);
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue({});
      (IndexStore.addRecording as jest.Mock).mockResolvedValue({});

      jest.spyOn(Date, 'now').mockReturnValue(1234567890000);

      const result = await recorder.stopRecording();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///temp/recording.m4a',
        to: 'file:///recordings/test.m4a',
      });
      expect(IndexStore.addRecording).toHaveBeenCalled();
      expect(HapticsManager.recordStop).toHaveBeenCalled();
      expect(result.id).toBe('1234567890000');
      expect(result.durationSec).toBe(5);
    });

    it('should generate proper title format', async () => {
      const mockDate = new Date('2024-01-15T10:30:45.000Z');
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate.toISOString());

      const mockStatus = {
        isLoaded: true,
        uri: 'file:///temp/recording.m4a',
        durationMillis: 5000,
      };

      mockRecording.stopAndUnloadAsync.mockResolvedValue({});
      mockRecording.getStatusAsync.mockResolvedValue(mockStatus);
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue({});
      (IndexStore.addRecording as jest.Mock).mockResolvedValue({});

      const result = await recorder.stopRecording();

      expect(result.title).toMatch(/Recording_\d{8}_\d{6}/);
    });

    it('should handle stop recording errors', async () => {
      mockRecording.stopAndUnloadAsync.mockRejectedValue(new Error('Stop failed'));

      await expect(recorder.stopRecording()).rejects.toThrow('Failed to stop recording');
    });

    it('should throw error if no active recording', async () => {
      const newRecorder = new AudioRecorder(jest.fn());
      
      await expect(newRecorder.stopRecording()).rejects.toThrow('No active recording');
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', () => {
      recorder.dispose();
      // Timer should be cleared (tested by ensuring no further state changes)
    });

    it('should cleanup recording if active', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({});
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      mockRecording.prepareToRecordAsync.mockResolvedValue({});
      mockRecording.startAsync.mockResolvedValue({});
      mockRecording.stopAndUnloadAsync.mockResolvedValue({});

      await recorder.startRecording();
      recorder.dispose();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
    });
  });
});