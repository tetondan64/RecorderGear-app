import { useState } from 'react';
import { Audio } from 'expo-av';
import { getRecordingPath, ensureRecordingsDirectory } from '../fs/paths';
import { RecordingEntry } from '../fs/indexStore';
import { HapticsManager } from '../haptics';
import * as FileSystem from 'expo-file-system';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  recordingUri?: string;
}

/**
 * CORRECT RECORDING IMPLEMENTATION - Following official Expo docs exactly
 * Based on: https://docs.expo.dev/versions/latest/sdk/audio/#recording-sounds
 */
export function useCorrectAudioRecorder(
  onStateChange: (state: RecordingState) => void,
  onRecordingComplete?: (recording: RecordingEntry) => Promise<void>
) {
  const [recording, setRecording] = useState<Audio.Recording | undefined>();
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [duration, setDuration] = useState(0);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);

  async function startRecording() {
    try {
      console.log('CORRECT: Starting recording following Expo docs pattern...');
      
      // Step 1: Request permissions (exactly as in docs)
      if (permissionResponse?.status !== 'granted') {
        console.log('CORRECT: Requesting permission..');
        await requestPermission();
      }

      // Step 2: Set audio mode (exactly as in docs)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Step 3: Create recording (exactly as in docs) 
      console.log('CORRECT: Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      
      console.log('CORRECT: Recording started successfully!');

      // Start duration timer
      let currentDuration = 0;
      const timer = setInterval(() => {
        currentDuration += 1;
        setDuration(currentDuration);
        onStateChange({
          isRecording: true,
          duration: currentDuration,
        });
      }, 1000) as any;
      setTimerRef(timer);

      await HapticsManager.recordStart();
      
      onStateChange({
        isRecording: true,
        duration: 0,
      });
      
    } catch (err) {
      console.error('CORRECT: Failed to start recording', err);
      throw new Error('Failed to start recording');
    }
  }

  async function stopRecording(): Promise<RecordingEntry> {
    try {
      if (!recording) {
        throw new Error('No recording in progress');
      }

      console.log('CORRECT: Stopping recording..');
      
      // Clear timer
      if (timerRef) {
        clearInterval(timerRef);
        setTimerRef(null);
      }

      // Stop and unload (exactly as in docs)
      setRecording(undefined);
      await recording.stopAndUnloadAsync();
      
      // Reset audio mode (exactly as in docs)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      console.log('CORRECT: Recording stopped and stored at', uri);

      if (!uri) {
        throw new Error('Recording URI not available');
      }

      // Generate unique ID and create file path
      const id = Date.now().toString();
      const finalPath = getRecordingPath(id);
      
      // Ensure recordings directory exists
      await ensureRecordingsDirectory();
      
      // Create recording entry
      const now = new Date().toISOString();
      const title = generateTitle(now);
      
      const entry: RecordingEntry = {
        id,
        fileUri: finalPath,
        title,
        durationSec: duration,
        createdAt: now,
        updatedAt: now,
      };

      // Copy file to permanent location
      try {
        await FileSystem.copyAsync({
          from: uri,
          to: finalPath,
        });
        
        const targetInfo = await FileSystem.getInfoAsync(finalPath);
        if (!targetInfo.exists) {
          console.log('CORRECT: Copy failed, using original location');
          entry.fileUri = uri;
        }
      } catch (copyError) {
        console.error('CORRECT: File copy error:', copyError);
        entry.fileUri = uri;
      }

      // Save recording using callback or fallback to IndexStore
      if (onRecordingComplete) {
        console.log('CORRECT: Using callback to save recording:', entry);
        await onRecordingComplete(entry);
        console.log('CORRECT: Recording saved via callback successfully');
      } else {
        console.log('CORRECT: Adding recording to IndexStore directly:', entry);
        const { IndexStore } = await import('../fs/indexStore');
        await IndexStore.addRecording(entry);
        console.log('CORRECT: Recording added to IndexStore successfully');
      }

      // Trigger auto-sync for newly saved recording
      try {
        const { onRecordingSavedTrigger } = await import('../sync/integration');
        await onRecordingSavedTrigger(entry);
        console.log('CORRECT: Auto-sync triggered for recording:', entry.id);
      } catch (syncError) {
        console.warn('CORRECT: Auto-sync trigger failed (non-blocking):', syncError);
        // Don't throw - sync failure shouldn't break recording save
      }
      
      await HapticsManager.recordStop();
      
      // Reset state
      setDuration(0);
      onStateChange({
        isRecording: false,
        duration: 0,
        recordingUri: entry.fileUri,
      });

      console.log('CORRECT: Recording saved successfully');
      return entry;
      
    } catch (err) {
      console.error('CORRECT: Failed to stop recording', err);
      throw new Error('Failed to stop recording');
    }
  }

  return {
    startRecording,
    stopRecording,
    isRecording: recording ? true : false,
    duration,
  };
}

function generateTitle(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return `Recording_${year}${month}${day}_${hour}${minute}${second}`;
}