import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useCorrectAudioRecorder, RecordingState } from '../../src/lib/audio/recording-correct';
import { RecordingEntry } from '../../src/lib/fs/indexStore';
import { useRecordings } from '../../src/lib/store/recordings';

export default function RecordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRecording } = useRecordings();
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
  });

  const handleRecordingComplete = useCallback(async (recording: RecordingEntry) => {
    console.log('RECORD SCREEN: Adding recording to store:', recording);
    await addRecording(recording);
  }, [addRecording]);

  const audioRecorder = useCorrectAudioRecorder(
    (state) => setRecordingState(state),
    handleRecordingComplete
  );

  const handleRecordPress = useCallback(async () => {
    try {
      if (recordingState.isRecording) {
        const recording: RecordingEntry = await audioRecorder.stopRecording();
        console.log('RECORD SCREEN: Recording saved:', {
          id: recording.id,
          title: recording.title,
          fileUri: recording.fileUri
        });
        Alert.alert(
          'Recording Saved',
          `Recording "${recording.title}" saved successfully!`,
          [
            {
              text: 'View in Library',
              onPress: () => router.push('/(tabs)/library'),
            },
            { text: 'Record Another', style: 'default' },
          ]
        );
      } else {
        await audioRecorder.startRecording();
      }
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert(
        'Recording Error',
        'Failed to start/stop recording. Please ensure microphone permissions are granted and try again.',
        [{ text: 'OK' }]
      );
    }
  }, [recordingState.isRecording, audioRecorder, router]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top, // Use safe area insets
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography.sizes.xxxl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xxl,
    },
    recordButton: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: theme.spacing.xl,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    recordButtonRecording: {
      backgroundColor: theme.colors.error,
      transform: [{ scale: 1.1 }],
    },
    recordButtonReady: {
      backgroundColor: theme.colors.primary,
    },
    recordButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
    buttonText: {
      color: 'white',
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.bold,
    },
    status: {
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.lg,
    },
    duration: {
      fontSize: theme.typography.sizes.xxxl,
      fontWeight: theme.typography.weights.bold,
      color: recordingState.isRecording ? theme.colors.error : theme.colors.text,
      marginTop: theme.spacing.md,
      fontFamily: 'monospace',
    },
    permissionContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    permissionText: {
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    permissionButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: 8,
    },
    permissionButtonText: {
      color: 'white',
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.medium,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Record</Text>
        <Text style={styles.subtitle}>
          Phase F1 - Expo AV Recording System
        </Text>

        <TouchableOpacity
          style={[
            styles.recordButton,
            recordingState.isRecording ? styles.recordButtonRecording : styles.recordButtonReady,
          ]}
          onPress={handleRecordPress}
        >
          <Text style={styles.buttonText}>
            {recordingState.isRecording ? 'STOP' : 'RECORD'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.status}>
          {recordingState.isRecording ? 'Recording in progress...' : 'Ready to record'}
        </Text>
        
        <Text style={styles.duration}>
          {formatDuration(recordingState.duration)}
        </Text>
      </View>
    </View>
  );
}