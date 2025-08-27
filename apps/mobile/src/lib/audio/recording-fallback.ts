import { Audio } from 'expo-av';
import { getRecordingPath, ensureRecordingsDirectory } from '../fs/paths';
import { IndexStore, RecordingEntry } from '../fs/indexStore';
import { HapticsManager } from '../haptics';
import * as FileSystem from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  recordingUri?: string;
}

// Use RecordingOptionsPresets for compatibility
const EXPO_AV_RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;

export function useExpoAvRecorderManager(onStateChange: (state: RecordingState) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const startRecording = useCallback(async () => {
    try {
      console.log('FALLBACK: Starting expo-av recording...');
      
      // Request permissions
      const permissionResult = await Audio.requestPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Recording permission not granted');
      }

      // Set audio mode - simplified since hybrid manager handles session management  
      console.log('FALLBACK: Configuring audio mode for expo-av...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log('FALLBACK: Audio mode configured successfully');

      // Create new recording
      const { recording: newRecording } = await Audio.Recording.createAsync(EXPO_AV_RECORDING_OPTIONS);
      setRecording(newRecording);
      setIsRecording(true);

      // Start duration timer
      let currentDuration = 0;
      timerRef.current = setInterval(() => {
        currentDuration += 1;
        setDuration(currentDuration);
        onStateChange({
          isRecording: true,
          duration: currentDuration,
        });
      }, 1000) as any;

      await HapticsManager.recordStart();
      
      onStateChange({
        isRecording: true,
        duration: 0,
      });
      
      console.log('FALLBACK: Recording started with expo-av');
    } catch (error) {
      console.error('FALLBACK: Failed to start expo-av recording:', error);
      throw new Error('Failed to start recording with fallback method');
    }
  }, [onStateChange]);

  const stopRecording = useCallback(async (): Promise<RecordingEntry> => {
    try {
      if (!recording) {
        throw new Error('No recording in progress');
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop recording
      console.log('FALLBACK: Stopping expo-av recording...');
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const recordingUri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (!recordingUri) {
        throw new Error('Recording URI not available');
      }

      console.log('FALLBACK: Recording stopped, URI:', recordingUri);

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
          from: recordingUri,
          to: finalPath,
        });
        
        const targetInfo = await FileSystem.getInfoAsync(finalPath);
        if (!targetInfo.exists) {
          console.log('FALLBACK: Copy failed, using cache location directly');
          entry.fileUri = recordingUri;
        }
      } catch (copyError) {
        console.error('FALLBACK: File copy error:', copyError);
        entry.fileUri = recordingUri;
      }

      // Add to index
      await IndexStore.addRecording(entry);
      
      await HapticsManager.recordStop();
      
      // Reset state
      setDuration(0);
      onStateChange({
        isRecording: false,
        duration: 0,
        recordingUri: entry.fileUri,
      });

      console.log('FALLBACK: Recording saved successfully');
      return entry;
    } catch (error) {
      console.error('FALLBACK: Failed to stop recording:', error);
      setIsRecording(false);
      setDuration(0);
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
      throw new Error('Failed to stop recording');
    }
  }, [recording, duration, onStateChange]);

  const dispose = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (recording && isRecording) {
      recording.stopAndUnloadAsync().catch(console.error);
      setRecording(null);
      setIsRecording(false);
      setDuration(0);
    }
  }, [recording, isRecording]);

  return {
    startRecording,
    stopRecording,
    dispose,
    isRecording,
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