import { Audio } from 'expo-av';
import { AudioPlayer } from '../../audio/player';
import { HapticsManager } from '../haptics';

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock('../haptics', () => ({
  HapticsManager: {
    playToggle: jest.fn(),
  },
}));

const mockSound = {
  unloadAsync: jest.fn(),
  playAsync: jest.fn(),
  pauseAsync: jest.fn(),
  setPositionAsync: jest.fn(),
  stopAsync: jest.fn(),
};

describe('AudioPlayer', () => {
  let onStateChange: jest.Mock;
  let player: AudioPlayer;

  beforeEach(() => {
    jest.clearAllMocks();
    onStateChange = jest.fn();
    player = new AudioPlayer(onStateChange);
  });

  describe('loadAudio', () => {
    it('should load audio successfully', async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });

      await player.loadAudio('file:///test.m4a');

      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
      });
      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: 'file:///test.m4a' },
        {
          shouldPlay: false,
          isLooping: false,
          progressUpdateIntervalMillis: 100,
        },
        expect.any(Function)
      );
      expect(onStateChange).toHaveBeenCalledWith({
        isLoaded: true,
        isPlaying: false,
        position: 0,
        duration: 0,
      });
    });

    it('should cleanup existing sound before loading new one', async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });

      // Load first audio
      await player.loadAudio('file:///test1.m4a');
      
      // Load second audio
      await player.loadAudio('file:///test2.m4a');

      expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle load errors', async () => {
      (Audio.Sound.createAsync as jest.Mock).mockRejectedValue(new Error('Load failed'));

      await player.loadAudio('file:///invalid.m4a');

      expect(onStateChange).toHaveBeenCalledWith({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: 'Failed to load audio',
      });
    });
  });

  describe('play', () => {
    beforeEach(async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      await player.loadAudio('file:///test.m4a');
    });

    it('should play audio successfully', async () => {
      mockSound.playAsync.mockResolvedValue({});

      await player.play();

      expect(mockSound.playAsync).toHaveBeenCalled();
      expect(HapticsManager.playToggle).toHaveBeenCalled();
    });

    it('should throw error if no audio loaded', async () => {
      const newPlayer = new AudioPlayer(jest.fn());
      
      await expect(newPlayer.play()).rejects.toThrow('No audio loaded');
    });

    it('should handle play errors', async () => {
      mockSound.playAsync.mockRejectedValue(new Error('Play failed'));

      await expect(player.play()).rejects.toThrow('Failed to play audio');
    });
  });

  describe('pause', () => {
    beforeEach(async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      await player.loadAudio('file:///test.m4a');
    });

    it('should pause audio successfully', async () => {
      mockSound.pauseAsync.mockResolvedValue({});

      await player.pause();

      expect(mockSound.pauseAsync).toHaveBeenCalled();
      expect(HapticsManager.playToggle).toHaveBeenCalled();
    });

    it('should throw error if no audio loaded', async () => {
      const newPlayer = new AudioPlayer(jest.fn());
      
      await expect(newPlayer.pause()).rejects.toThrow('No audio loaded');
    });

    it('should handle pause errors', async () => {
      mockSound.pauseAsync.mockRejectedValue(new Error('Pause failed'));

      await expect(player.pause()).rejects.toThrow('Failed to pause audio');
    });
  });

  describe('seekTo', () => {
    beforeEach(async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      await player.loadAudio('file:///test.m4a');
    });

    it('should seek to position successfully', async () => {
      mockSound.setPositionAsync.mockResolvedValue({});

      await player.seekTo(5000);

      expect(mockSound.setPositionAsync).toHaveBeenCalledWith(5000);
    });

    it('should throw error if no audio loaded', async () => {
      const newPlayer = new AudioPlayer(jest.fn());
      
      await expect(newPlayer.seekTo(1000)).rejects.toThrow('No audio loaded');
    });

    it('should handle seek errors', async () => {
      mockSound.setPositionAsync.mockRejectedValue(new Error('Seek failed'));

      await expect(player.seekTo(1000)).rejects.toThrow('Failed to seek audio');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      await player.loadAudio('file:///test.m4a');
    });

    it('should stop audio successfully', async () => {
      mockSound.stopAsync.mockResolvedValue({});
      mockSound.setPositionAsync.mockResolvedValue({});

      await player.stop();

      expect(mockSound.stopAsync).toHaveBeenCalled();
      expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
    });

    it('should handle case when no audio is loaded', async () => {
      const newPlayer = new AudioPlayer(jest.fn());
      
      await expect(player.stop()).resolves.not.toThrow();
    });

    it('should handle stop errors gracefully', async () => {
      mockSound.stopAsync.mockRejectedValue(new Error('Stop failed'));

      await expect(player.stop()).resolves.not.toThrow();
    });
  });

  describe('onPlaybackStatusUpdate', () => {
    beforeEach(async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      await player.loadAudio('file:///test.m4a');
    });

    it('should handle loaded status', async () => {
      const statusUpdate = {
        isLoaded: true,
        isPlaying: true,
        positionMillis: 1500,
        durationMillis: 10000,
      };

      // Get the callback passed to createAsync
      const createAsyncCall = (Audio.Sound.createAsync as jest.Mock).mock.calls[0];
      const onPlaybackStatusUpdate = createAsyncCall[2];

      onPlaybackStatusUpdate(statusUpdate);

      expect(onStateChange).toHaveBeenCalledWith({
        isLoaded: true,
        isPlaying: true,
        position: 1500,
        duration: 10000,
      });
    });

    it('should handle not loaded status', async () => {
      const statusUpdate = {
        isLoaded: false,
        error: 'Audio not loaded',
      };

      const createAsyncCall = (Audio.Sound.createAsync as jest.Mock).mock.calls[0];
      const onPlaybackStatusUpdate = createAsyncCall[2];

      onPlaybackStatusUpdate(statusUpdate);

      expect(onStateChange).toHaveBeenCalledWith({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: 'Audio not loaded',
      });
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', () => {
      player.dispose();
      // Should not throw
    });

    it('should unload sound if exists', async () => {
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue({});
      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
        sound: mockSound,
      });
      mockSound.unloadAsync.mockResolvedValue({});

      await player.loadAudio('file:///test.m4a');
      player.dispose();

      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });
  });
});