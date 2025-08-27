import { Audio, AVPlaybackStatus } from 'expo-av';
import { getRecordingPath } from '../fs/paths';
import { IndexStore, RecordingEntry } from '../fs/indexStore';
import { HapticsManager } from '../haptics';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  recordingUri?: string;
}

export class AudioRecorder {
  private recording?: Audio.Recording;
  private timerRef?: NodeJS.Timeout;

  constructor(
    private onStateChange: (state: RecordingState) => void
  ) {}

  async startRecording(): Promise<void> {
    try {
      // Request permissions and configure audio
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with high quality settings
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        },
        web: {
          mimeType: 'audio/mp4',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      this.recording = recording;

      // Start timer
      let duration = 0;
      this.timerRef = setInterval(() => {
        duration += 1;
        this.onStateChange({
          isRecording: true,
          duration,
        });
      }, 1000);

      await HapticsManager.recordStart();
      
      this.onStateChange({
        isRecording: true,
        duration: 0,
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  async stopRecording(): Promise<RecordingEntry> {
    if (!this.recording) {
      throw new Error('No active recording');
    }

    try {
      // Clear timer
      if (this.timerRef) {
        clearInterval(this.timerRef);
        this.timerRef = undefined;
      }

      // Stop recording and get status
      await this.recording.stopAndUnloadAsync();
      const status = await this.recording.getStatusAsync();
      
      if (!status.isLoaded || !status.uri) {
        throw new Error('Recording failed to load');
      }

      // Generate unique ID and create file path
      const id = Date.now().toString();
      const finalPath = getRecordingPath(id);
      
      // Move recording to final location
      const { uri: tempUri } = status;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Create recording entry
      const now = new Date().toISOString();
      const title = this.generateTitle(now);
      
      const entry: RecordingEntry = {
        id,
        fileUri: finalPath,
        title,
        durationSec: Math.floor((status.durationMillis || 0) / 1000),
        createdAt: now,
        updatedAt: now,
      };

      // Copy file to permanent location
      const fs = require('expo-file-system');
      await fs.copyAsync({
        from: tempUri,
        to: finalPath,
      });

      // Add to index
      await IndexStore.addRecording(entry);
      
      // Cleanup
      this.recording = undefined;
      
      await HapticsManager.recordStop();
      
      this.onStateChange({
        isRecording: false,
        duration: 0,
        recordingUri: finalPath,
      });

      return entry;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = undefined;
      throw new Error('Failed to stop recording');
    }
  }

  private generateTitle(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `Recording_${year}${month}${day}_${hour}${minute}${second}`;
  }

  dispose(): void {
    if (this.timerRef) {
      clearInterval(this.timerRef);
    }
    
    if (this.recording) {
      this.recording.stopAndUnloadAsync().catch(console.error);
    }
  }
}