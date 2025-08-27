import { useAudioRecorder, setAudioModeAsync, RecordingOptions, RecordingStatus, IOSOutputFormat, AudioQuality, requestRecordingPermissionsAsync } from 'expo-audio';
import { getRecordingPath, ensureRecordingsDirectory } from '../fs/paths';
import { IndexStore, RecordingEntry } from '../fs/indexStore';
import { HapticsManager } from '../haptics';
import * as FileSystem from 'expo-file-system';
import { useCallback, useRef, useState, useMemo } from 'react';
import { Platform } from 'react-native';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  recordingUri?: string;
}

// Try with very basic recording options
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 2,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
  },
};

export function useAudioRecorderManager(onStateChange: (state: RecordingState) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recorderInitialized = useRef(false);
  
  const handleRecordingStatusUpdate = useCallback((status: RecordingStatus) => {
    console.log('Recording status update:', JSON.stringify(status, null, 2));
  }, []);

  // Only log on first initialization to avoid spam
  if (!recorderInitialized.current) {
    console.log('About to create recorder with options:', RECORDING_OPTIONS);
    recorderInitialized.current = true;
  }
  
  const recorder = useAudioRecorder(RECORDING_OPTIONS, handleRecordingStatusUpdate);
  
  if (!recorderInitialized.current && recorder) {
    console.log('Recorder created successfully:', recorder ? 'YES' : 'NO');
    console.log('Recorder details:', {
      id: recorder.id,
      isRecording: recorder.isRecording,
      uri: recorder.uri,
      currentTime: recorder.currentTime,
      type: typeof recorder.record
    });
  }

  const startRecording = useCallback(async () => {
    try {
      // Request permissions first
      console.log('Requesting recording permissions...');
      const permissionResult = await requestRecordingPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (!permissionResult.granted) {
        throw new Error('Recording permission not granted');
      }
      
      // Configure audio mode - simplified since hybrid manager handles session management
      console.log('Configuring audio mode for expo-audio...');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      console.log('Audio mode configured successfully');

      console.log('Recorder state before prepare:', {
        isRecording: recorder.isRecording,
        uri: recorder.uri,
        currentTime: recorder.currentTime
      });

      // First, prepare the recorder (this might be required)
      console.log('About to call prepareToRecordAsync()');
      if (typeof recorder.prepareToRecordAsync === 'function') {
        try {
          await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
          console.log('Recorder prepared successfully');
        } catch (prepareError) {
          console.error('Failed to prepare recorder:', prepareError);
          console.log('Continuing without prepare...');
        }
      }

      console.log('Recorder state before record():', {
        isRecording: recorder.isRecording,
        uri: recorder.uri,
        currentTime: recorder.currentTime
      });

      // Start recording
      console.log('About to call recorder.record()');
      console.log('recorder.record type:', typeof recorder.record);
      
      if (typeof recorder.record === 'function') {
        console.log('Calling recorder.record()...');
        const recordResult = recorder.record();
        console.log('record() result:', recordResult);
      } else {
        throw new Error('recorder.record is not a function');
      }
      
      // Wait longer and check multiple times
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log(`Check ${i + 1}/10 - Recorder state:`, {
          isRecording: recorder.isRecording,
          uri: recorder.uri,
          currentTime: recorder.currentTime
        });
        
        if (recorder.isRecording || recorder.currentTime > 0) {
          console.log('Recording started successfully!');
          break;
        }
      }
      
      if (!recorder.isRecording && recorder.currentTime === 0) {
        console.error('Recording failed to start after all attempts');
        throw new Error('Recording failed to start - expo-audio may not be working properly');
      }
      
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
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  }, [recorder, onStateChange]);

  const stopRecording = useCallback(async (): Promise<RecordingEntry> => {
    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop recording
      console.log('Calling recorder.stop()...');
      console.log('Recorder state before stop:', { 
        isRecording: recorder.isRecording, 
        uri: recorder.uri,
        currentTime: recorder.currentTime 
      });
      
      await recorder.stop();
      setIsRecording(false);
      
      console.log('Recorder state after stop:', { 
        isRecording: recorder.isRecording, 
        uri: recorder.uri,
        currentTime: recorder.currentTime 
      });
      
      console.log('Waiting 2 seconds for recording to finalize...');
      
      // Wait 2 seconds for the recording to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Recorder state after wait:', { 
        isRecording: recorder.isRecording, 
        uri: recorder.uri,
        currentTime: recorder.currentTime 
      });
      
      const recordingUri = recorder.uri;
      
      if (!recordingUri) {
        throw new Error('Recording URI not available');
      }

      console.log('Final recording URI:', recordingUri);

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
      console.log('Copying from:', recordingUri);
      console.log('Copying to:', finalPath);
      
      try {
        // Check if source file exists
        const sourceInfo = await FileSystem.getInfoAsync(recordingUri);
        console.log('Source file info:', sourceInfo);
        
        if (!sourceInfo.exists) {
          // If the file doesn't exist, maybe expo-audio works differently
          // Let's try using the cache location directly without copying
          console.log('Source file does not exist, using cache location directly');
          entry.fileUri = recordingUri;
        } else {
          // File exists, copy it to permanent location
          await FileSystem.copyAsync({
            from: recordingUri,
            to: finalPath,
          });
          
          // Verify the copy was successful
          const targetInfo = await FileSystem.getInfoAsync(finalPath);
          console.log('Target file info:', targetInfo);
          
          if (!targetInfo.exists) {
            console.log('Copy failed, using cache location directly');
            entry.fileUri = recordingUri;
          } else {
            console.log('File successfully copied to permanent location');
            entry.fileUri = finalPath;
          }
        }
      } catch (copyError) {
        console.error('File copy error:', copyError);
        console.log('Falling back to using cache location directly');
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

      return entry;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setDuration(0);
      throw new Error('Failed to stop recording');
    }
  }, [recorder, duration, onStateChange]);

  const dispose = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (isRecording) {
      recorder.stop();
      setIsRecording(false);
      setDuration(0);
    }
    
  }, [recorder, isRecording]);

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