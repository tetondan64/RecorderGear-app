import { useCallback, useState, useRef, useEffect } from 'react';
import { useAudioRecorderManager } from './recording-new';
import { useExpoAvRecorderManager, RecordingState } from './recording-fallback';
import { RecordingEntry } from '../fs/indexStore';
import { AudioSessionManager } from './audioSession';

type RecorderType = 'expo-audio' | 'expo-av';

interface HybridRecorderManager {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingEntry>;
  dispose: () => void;
  isRecording: boolean;
  duration: number;
  recorderType: RecorderType;
}

export function useHybridRecorderManager(onStateChange: (state: RecordingState) => void): HybridRecorderManager {
  const [recorderType, setRecorderType] = useState<RecorderType>('expo-audio');
  const [shouldUseFallback, setShouldUseFallback] = useState(false);
  const attemptedExpoAudio = useRef(false);

  // Create both recorder managers
  const expoAudioRecorder = useAudioRecorderManager(onStateChange);
  const expoAvRecorder = useExpoAvRecorderManager(onStateChange);

  // Use the appropriate recorder based on fallback state
  const activeRecorder = shouldUseFallback ? expoAvRecorder : expoAudioRecorder;

  const startRecording = useCallback(async () => {
    if (!shouldUseFallback && !attemptedExpoAudio.current) {
      // First attempt with expo-audio
      console.log('HYBRID: Attempting to start recording with expo-audio...');
      attemptedExpoAudio.current = true;
      
      try {
        // Check microphone availability first
        const micAvailable = await AudioSessionManager.checkMicrophoneAvailability();
        if (!micAvailable) {
          console.log('HYBRID: Microphone may be in use by another app');
        }
        
        // Reset audio session before attempting
        await AudioSessionManager.resetAudioSession();
        await AudioSessionManager.configureForExpoAudio();
        
        await expoAudioRecorder.startRecording();
        setRecorderType('expo-audio');
        console.log('HYBRID: Successfully started recording with expo-audio');
        return;
      } catch (error) {
        console.error('HYBRID: expo-audio failed:', error);
        console.log('HYBRID: Falling back to expo-av...');
        setShouldUseFallback(true);
        setRecorderType('expo-av');
        
        // Reset session before fallback attempt
        await AudioSessionManager.resetAudioSession();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
          await AudioSessionManager.configureForExpoAv();
          await expoAvRecorder.startRecording();
          console.log('HYBRID: Successfully started recording with expo-av fallback');
          return;
        } catch (fallbackError) {
          console.error('HYBRID: Both expo-audio and expo-av failed:', fallbackError);
          
          // Final attempt: try minimal configuration
          console.log('HYBRID: Attempting minimal configuration as last resort...');
          try {
            await AudioSessionManager.tryMinimalConfiguration();
            await expoAvRecorder.startRecording();
            console.log('HYBRID: Minimal configuration recording started successfully');
            return;
          } catch (minimalError) {
            console.error('HYBRID: Even minimal configuration failed:', minimalError);
            await AudioSessionManager.resetAudioSession();
            throw new Error('All recording methods failed - iOS audio session cannot be activated. Device restart may be required.');
          }
        }
      }
    } else {
      // Use the active recorder (either expo-av fallback or expo-audio if it worked before)
      console.log(`HYBRID: Starting recording with ${recorderType}...`);
      await activeRecorder.startRecording();
    }
  }, [shouldUseFallback, expoAudioRecorder, expoAvRecorder, activeRecorder, recorderType]);

  const stopRecording = useCallback(async (): Promise<RecordingEntry> => {
    console.log(`HYBRID: Stopping recording with ${recorderType}...`);
    try {
      const result = await activeRecorder.stopRecording();
      console.log(`HYBRID: Recording stopped successfully with ${recorderType}`);
      
      // Clean up audio session after recording
      setTimeout(async () => {
        await AudioSessionManager.resetAudioSession();
      }, 1000);
      
      return result;
    } catch (error) {
      console.error('HYBRID: Error stopping recording:', error);
      // Ensure audio session is reset even if stopping fails
      await AudioSessionManager.resetAudioSession();
      throw error;
    }
  }, [activeRecorder, recorderType]);

  const dispose = useCallback(() => {
    console.log('HYBRID: Disposing recorders...');
    expoAudioRecorder.dispose();
    expoAvRecorder.dispose();
  }, [expoAudioRecorder, expoAvRecorder]);

  // Reset fallback state when component unmounts or resets
  useEffect(() => {
    return () => {
      attemptedExpoAudio.current = false;
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    dispose,
    isRecording: activeRecorder.isRecording,
    duration: activeRecorder.duration,
    recorderType,
  };
}