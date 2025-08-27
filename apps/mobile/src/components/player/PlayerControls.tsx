import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlayerState } from '../../lib/audio/player-new';

interface PlayerControlsProps {
  playerState: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek?: (position: number) => void;
  disabled?: boolean;
}

export function PlayerControls({
  playerState,
  onPlay,
  onPause,
  onStop,
  onSeek,
  disabled = false,
}: PlayerControlsProps) {
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSkipBack = () => {
    if (onSeek && playerState.position > 0) {
      const newPosition = Math.max(0, playerState.position - 15000); // Skip back 15 seconds
      onSeek(newPosition);
    }
  };

  const handleSkipForward = () => {
    if (onSeek && playerState.position < playerState.duration) {
      const newPosition = Math.min(playerState.duration, playerState.position + 15000); // Skip forward 15 seconds
      onSeek(newPosition);
    }
  };

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  if (!playerState.isLoaded && !disabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading audio...</Text>
      </View>
    );
  }

  if (playerState.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{playerState.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Time Display */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(playerState.position)}
        </Text>
        <Text style={styles.timeSeparator}>/</Text>
        <Text style={styles.timeText}>
          {formatTime(playerState.duration)}
        </Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {/* Skip Back 15s */}
        <TouchableOpacity
          style={[styles.controlButton, styles.skipButton]}
          onPress={handleSkipBack}
          disabled={disabled || !playerState.isLoaded || playerState.position === 0}
        >
          <Ionicons name="play-back" size={24} color={disabled ? "#ccc" : "#666"} />
          <Text style={[styles.skipText, disabled && styles.disabledText]}>15</Text>
        </TouchableOpacity>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.playButton, disabled && styles.disabledButton]}
          onPress={handlePlayPause}
          disabled={disabled || !playerState.isLoaded}
        >
          <Ionicons
            name={playerState.isPlaying ? "pause" : "play"}
            size={36}
            color={disabled ? "#ccc" : "white"}
          />
        </TouchableOpacity>

        {/* Skip Forward 15s */}
        <TouchableOpacity
          style={[styles.controlButton, styles.skipButton]}
          onPress={handleSkipForward}
          disabled={disabled || !playerState.isLoaded || playerState.position >= playerState.duration}
        >
          <Ionicons name="play-forward" size={24} color={disabled ? "#ccc" : "#666"} />
          <Text style={[styles.skipText, disabled && styles.disabledText]}>15</Text>
        </TouchableOpacity>
      </View>

      {/* Stop Button */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.stopButton, disabled && styles.disabledButton]}
          onPress={onStop}
          disabled={disabled || !playerState.isLoaded}
        >
          <Ionicons name="stop" size={20} color={disabled ? "#ccc" : "#666"} />
          <Text style={[styles.stopText, disabled && styles.disabledText]}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#999',
    marginHorizontal: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: 60,
    height: 60,
    marginHorizontal: 20,
    position: 'relative',
  },
  skipText: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    bottom: 8,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    marginHorizontal: 30,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  bottomControls: {
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  stopText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#666',
  },
  disabledText: {
    color: '#ccc',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginVertical: 40,
    textAlign: 'center',
  },
});