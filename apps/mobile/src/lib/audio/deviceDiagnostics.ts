import { Alert, Platform } from 'react-native';

export class DeviceAudioDiagnostics {
  /**
   * Check for known iOS audio session issues and provide user guidance
   */
  static async diagnoseAudioSessionError(error: Error): Promise<string> {
    const errorMessage = error.message;
    
    // iOS Session activation failed (Code=561017449)
    if (errorMessage.includes('561017449') || errorMessage.includes('Session activation failed')) {
      return this.handleSessionActivationFailure();
    }
    
    // Audio session configuration failed
    if (errorMessage.includes('Failed to configure audio session')) {
      return this.handleConfigurationFailure();
    }
    
    // General audio recording error
    if (errorMessage.includes('Audio recording error')) {
      return this.handleRecordingError();
    }
    
    return 'Unknown audio system error';
  }
  
  /**
   * Handle iOS Session activation failed error
   */
  private static handleSessionActivationFailure(): string {
    if (Platform.OS === 'ios') {
      return 'iOS_SESSION_ACTIVATION_FAILED';
    }
    return 'GENERIC_SESSION_ERROR';
  }
  
  /**
   * Handle audio session configuration errors
   */
  private static handleConfigurationFailure(): string {
    return 'AUDIO_CONFIGURATION_ERROR';
  }
  
  /**
   * Handle general recording errors
   */
  private static handleRecordingError(): string {
    return 'GENERIC_RECORDING_ERROR';
  }
  
  /**
   * Show appropriate user alert based on error type
   */
  static showUserAlert(errorType: string): void {
    switch (errorType) {
      case 'iOS_SESSION_ACTIVATION_FAILED':
        Alert.alert(
          'Recording Not Available',
          'The microphone may be in use by another app, or iOS needs to reset its audio system.\n\nTroubleshooting steps:\n\n• Close all other apps that might use the microphone\n• Check Control Center for any active recordings\n• Try restarting your device\n• Ensure microphone permissions are granted',
          [
            { text: 'Check Settings', onPress: this.openDeviceSettings },
            { text: 'OK', style: 'default' }
          ]
        );
        break;
        
      case 'AUDIO_CONFIGURATION_ERROR':
        Alert.alert(
          'Audio Setup Error',
          'Unable to configure the audio system for recording. Please try again or restart the app.',
          [{ text: 'OK' }]
        );
        break;
        
      case 'GENERIC_RECORDING_ERROR':
        Alert.alert(
          'Recording Error',
          'An error occurred while trying to record. Please ensure microphone permissions are granted and try again.',
          [{ text: 'OK' }]
        );
        break;
        
      default:
        Alert.alert(
          'Audio System Error',
          'An unexpected audio system error occurred. Please try restarting the app.',
          [{ text: 'OK' }]
        );
        break;
    }
  }
  
  /**
   * Open device settings (iOS only)
   */
  private static openDeviceSettings(): void {
    if (Platform.OS === 'ios') {
      // This would open iOS Settings app, but requires additional setup
      console.log('Would open iOS Settings app');
    }
  }
  
  /**
   * Check if we should recommend device restart based on error patterns
   */
  static shouldRecommendRestart(consecutiveFailures: number): boolean {
    return consecutiveFailures >= 3;
  }
  
  /**
   * Show device restart recommendation
   */
  static showRestartRecommendation(): void {
    Alert.alert(
      'Device Restart Recommended',
      'Multiple recording attempts have failed due to iOS audio system issues. Restarting your device may resolve this problem.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart Now', onPress: this.explainRestartProcess }
      ]
    );
  }
  
  /**
   * Explain how to restart device
   */
  private static explainRestartProcess(): void {
    Alert.alert(
      'How to Restart',
      'To restart your iOS device:\n\n1. Press and hold the power button and volume button\n2. Slide to power off\n3. Wait 10 seconds\n4. Press the power button to turn back on\n\nThis will clear any audio system conflicts.',
      [{ text: 'OK' }]
    );
  }
}