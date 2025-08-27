import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RecordTimerProps {
  duration: number;
  isRecording: boolean;
}

export function RecordTimer({ duration, isRecording }: RecordTimerProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.timer, isRecording && styles.recording]}>
        {formatTime(duration)}
      </Text>
      {isRecording && (
        <View style={styles.waveform} testID="waveform-container">
          {Array.from({ length: 5 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: Math.random() * 20 + 10,
                  animationDelay: `${i * 100}ms`,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  recording: {
    color: '#ff4444',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    marginTop: 16,
    gap: 4,
  },
  waveBar: {
    width: 6,
    backgroundColor: '#ff4444',
    borderRadius: 3,
    opacity: 0.7,
  },
});