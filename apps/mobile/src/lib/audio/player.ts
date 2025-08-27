import { Audio, AVPlaybackStatus } from 'expo-av';
import { HapticsManager } from '../haptics';

export interface PlayerState {
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  error?: string;
}

export class AudioPlayer {
  private sound?: Audio.Sound;
  private positionUpdateRef?: NodeJS.Timeout;

  constructor(
    private onStateChange: (state: PlayerState) => void
  ) {}

  async loadAudio(uri: string): Promise<void> {
    try {
      // Cleanup existing sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
      });

      // Load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { 
          shouldPlay: false,
          isLooping: false,
          progressUpdateIntervalMillis: 100,
        },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      
      this.onStateChange({
        isLoaded: true,
        isPlaying: false,
        position: 0,
        duration: 0,
      });
    } catch (error) {
      console.error('Failed to load audio:', error);
      this.onStateChange({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: 'Failed to load audio',
      });
    }
  }

  async play(): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.playAsync();
      await HapticsManager.playToggle();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw new Error('Failed to play audio');
    }
  }

  async pause(): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.pauseAsync();
      await HapticsManager.playToggle();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      throw new Error('Failed to pause audio');
    }
  }

  async seekTo(positionMillis: number): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.setPositionAsync(positionMillis);
    } catch (error) {
      console.error('Failed to seek audio:', error);
      throw new Error('Failed to seek audio');
    }
  }

  async stop(): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  }

  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
      this.onStateChange({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: status.error || 'Audio not loaded',
      });
      return;
    }

    this.onStateChange({
      isLoaded: true,
      isPlaying: status.isPlaying || false,
      position: status.positionMillis || 0,
      duration: status.durationMillis || 0,
    });
  };

  dispose(): void {
    if (this.positionUpdateRef) {
      clearInterval(this.positionUpdateRef);
    }
    
    if (this.sound) {
      this.sound.unloadAsync().catch(console.error);
    }
  }
}