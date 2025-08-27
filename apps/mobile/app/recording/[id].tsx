import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCorrectAudioPlayer, PlayerState } from '../../src/lib/audio/player-correct';
import { PlayerControls } from '../../src/components/player/PlayerControls';
import { SeekBar } from '../../src/components/player/SeekBar';
import { useRecordings } from '../../src/lib/store/recordings';
import { formatDuration, formatTimestamp } from '../../src/lib/utils/format';
import { HapticsManager } from '../../src/lib/haptics';

export default function RecordingPlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getRecording, deleteRecording, recordings, loading: recordingsLoading } = useRecordings();

  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoaded: false,
    isPlaying: false,
    position: 0,
    duration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const loadedRecordingRef = useRef<string | null>(null);

  const recording = useMemo(() => {
    if (typeof id === 'string') {
      const found = getRecording(id);
      console.log('RECORDING LOOKUP DEBUG:', {
        requestedId: id,
        found: !!found,
        foundTitle: found?.title,
        totalRecordings: recordings.length,
        recordingsLoading,
        allIds: recordings.map(r => r.id)
      });
      return found;
    }
    return undefined;
  }, [id, getRecording, recordings, recordingsLoading]);

  const handlePlayerStateChange = useCallback((state: PlayerState) => {
    setPlayerState(state);
  }, []);

  const player = useCorrectAudioPlayer(handlePlayerStateChange);

  useEffect(() => {
    // Don't show error while recordings are still loading
    if (recordingsLoading) {
      return;
    }

    if (!recording) {
      setError('Recording not found');
      setLoading(false);
      return;
    }

    // Don't reload if we've already loaded this recording
    if (loadedRecordingRef.current === recording.id) {
      return;
    }

    const loadAudio = async () => {
      try {
        console.log('PLAYER SCREEN: Loading audio for recording:', recording.id);
        await player.loadAudio(recording.fileUri);
        loadedRecordingRef.current = recording.id;
      } catch (err) {
        console.error('Failed to load audio:', err);
        setError('Failed to load audio file');
      } finally {
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      // Only dispose if we're changing recordings
      if (loadedRecordingRef.current !== recording.id) {
        console.log('PLAYER SCREEN: Disposing player for recording change');
        player.dispose();
        loadedRecordingRef.current = null;
      }
    };
  }, [recording, recordingsLoading]); // Added recordingsLoading to dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('PLAYER SCREEN: Component unmounting, disposing player');
      player.dispose();
    };
  }, []);

  const handlePlay = async () => {
    try {
      await player.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('Playback Error', 'Failed to play the recording');
    }
  };

  const handlePause = async () => {
    try {
      await player.pause();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      Alert.alert('Playback Error', 'Failed to pause the recording');
    }
  };

  const handleStop = async () => {
    try {
      await player.stop();
    } catch (error) {
      console.error('Failed to stop audio:', error);
      Alert.alert('Playback Error', 'Failed to stop the recording');
    }
  };

  const handleSeek = async (position: number) => {
    try {
      await player.seekTo(position);
    } catch (error) {
      console.error('Failed to seek audio:', error);
      Alert.alert('Playback Error', 'Failed to seek in the recording');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${recording?.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (recording) {
                await deleteRecording(recording.id);
                await HapticsManager.delete();
                router.back();
              }
            } catch (error) {
              console.error('Failed to delete recording:', error);
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Loading...',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recording...</Text>
        </View>
      </View>
    );
  }

  if (error || !recording) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Error',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff4444" />
          <Text style={styles.errorTitle}>
            {error || 'Recording not found'}
          </Text>
          <Text style={styles.errorDescription}>
            {error ? 'Please try again or check if the file exists.' : 'The requested recording could not be found.'}
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: recording.title,
          headerBackTitle: 'Library',
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash" size={24} color="#ff4444" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.content}>
        {/* Recording Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{recording.title}</Text>
          <Text style={styles.metadata}>
            {formatDuration(recording.durationSec)} • {formatTimestamp(recording.createdAt)}
          </Text>
        </View>

        {/* Waveform Placeholder */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveformPlaceholder}>
            <Ionicons name="pulse" size={48} color="#ccc" />
            <Text style={styles.waveformText}>Audio Waveform</Text>
          </View>
        </View>

        {/* Seek Bar */}
        <SeekBar
          duration={playerState.duration}
          position={playerState.position}
          onSeek={handleSeek}
          disabled={!playerState.isLoaded}
        />

        {/* Player Controls */}
        <PlayerControls
          playerState={playerState}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSeek={handleSeek}
          disabled={!playerState.isLoaded}
        />

        {/* Additional Info */}
        <View style={styles.additionalInfo}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{formatTimestamp(recording.createdAt)}</Text>
          
          {recording.updatedAt !== recording.createdAt && (
            <>
              <Text style={styles.infoLabel}>Modified</Text>
              <Text style={styles.infoValue}>{formatTimestamp(recording.updatedAt)}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  metadata: {
    fontSize: 16,
    color: '#666',
  },
  waveformContainer: {
    height: 120,
    marginBottom: 32,
  },
  waveformPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  waveformText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  additionalInfo: {
    marginTop: 'auto',
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
});