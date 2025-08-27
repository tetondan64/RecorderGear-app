import { setAudioModeAsync } from 'expo-audio';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

/**
 * Audio session utility to help with iOS session activation issues
 */
export class AudioSessionManager {
  private static isSessionActive = false;
  
  /**
   * Reset and cleanup the audio session
   */
  static async resetAudioSession(): Promise<void> {
    console.log('AudioSessionManager: Resetting audio session...');
    
    try {
      // Try expo-audio reset first - fix iOS constraint
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true, // Must be true when allowsRecording is used on iOS
      });
      
      // Also try expo-av reset
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      
      this.isSessionActive = false;
      console.log('AudioSessionManager: Audio session reset successfully');
      
      // Wait for session to fully reset
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('AudioSessionManager: Failed to reset audio session:', error);
    }
  }
  
  /**
   * Configure audio session for recording with expo-audio
   */
  static async configureForExpoAudio(): Promise<void> {
    console.log('AudioSessionManager: Configuring for expo-audio recording...');
    
    if (this.isSessionActive) {
      await this.resetAudioSession();
    }
    
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        ...(Platform.OS === 'ios' && {
          interruptionModeIOS: 'duckOthers',
        }),
      });
      
      this.isSessionActive = true;
      console.log('AudioSessionManager: Expo-audio session configured');
    } catch (error) {
      console.error('AudioSessionManager: Expo-audio configuration failed:', error);
      throw error;
    }
  }
  
  /**
   * Configure audio session for recording with expo-av
   */
  static async configureForExpoAv(): Promise<void> {
    console.log('AudioSessionManager: Configuring for expo-av recording...');
    
    if (this.isSessionActive) {
      await this.resetAudioSession();
    }
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // Use numeric values instead of enum references to avoid import issues
        interruptionModeIOS: 2, // DuckOthers = 2
        shouldDuckAndroid: true,
        interruptionModeAndroid: 2, // DuckOthers = 2
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      
      this.isSessionActive = true;
      console.log('AudioSessionManager: Expo-av session configured');
    } catch (error) {
      console.error('AudioSessionManager: Expo-av configuration failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if another app might be using the microphone
   */
  static async checkMicrophoneAvailability(): Promise<boolean> {
    // On iOS, we can't directly check this, but we can try a quick audio mode test
    try {
      await setAudioModeAsync({
        allowsRecording: true,
      });
      
      await setAudioModeAsync({
        allowsRecording: false,
      });
      
      return true;
    } catch {
      console.log('AudioSessionManager: Microphone may not be available');
      return false;
    }
  }

  /**
   * Last resort: try absolute minimal configuration
   */
  static async tryMinimalConfiguration(): Promise<void> {
    console.log('AudioSessionManager: Attempting minimal configuration as last resort...');
    
    try {
      // Try expo-audio minimal
      await setAudioModeAsync({
        allowsRecording: true,
      });
      
      console.log('AudioSessionManager: Minimal expo-audio configuration succeeded');
    } catch (expoAudioError) {
      console.error('AudioSessionManager: Minimal expo-audio failed:', expoAudioError);
      
      try {
        // Try expo-av minimal
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
        });
        
        console.log('AudioSessionManager: Minimal expo-av configuration succeeded');
      } catch (expoAvError) {
        console.error('AudioSessionManager: All minimal configurations failed:', expoAvError);
        throw new Error('Device audio system appears to be unavailable');
      }
    }
  }
}