import React, { useState } from 'react';
import { View, TouchableWithoutFeedback, PanResponder, StyleSheet } from 'react-native';

interface SeekBarProps {
  duration: number;
  position: number;
  onSeek: (position: number) => void;
  disabled?: boolean;
  bufferedPosition?: number;
}

export function SeekBar({
  duration,
  position,
  onSeek,
  disabled = false,
  bufferedPosition = 0,
}: SeekBarProps) {
  const [seeking, setSeeking] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  // Calculate progress percentage
  const progress = duration > 0 ? position / duration : 0;
  const bufferedProgress = duration > 0 ? bufferedPosition / duration : 0;

  const handlePress = (event: any) => {
    if (disabled || trackWidth === 0) return;
    
    const touchX = event.nativeEvent.locationX;
    const newProgress = Math.max(0, Math.min(1, touchX / trackWidth));
    const newPosition = newProgress * duration;
    
    onSeek(newPosition);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => {
      setSeeking(true);
    },
    onPanResponderMove: (event) => {
      if (disabled || trackWidth === 0) return;
      
      const touchX = Math.max(0, Math.min(trackWidth, event.nativeEvent.locationX));
      const newProgress = touchX / trackWidth;
      const newPosition = newProgress * duration;
      
      onSeek(newPosition);
    },
    onPanResponderRelease: () => {
      setSeeking(false);
    },
  });

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View
          style={styles.trackContainer}
          onLayout={(event) => {
            setTrackWidth(event.nativeEvent.layout.width);
          }}
          {...panResponder.panHandlers}
        >
          {/* Background Track */}
          <View style={styles.track} />
          
          {/* Buffered Progress */}
          <View style={[styles.bufferedTrack, { width: `${bufferedProgress * 100}%` }]} />
          
          {/* Progress Track */}
          <View style={[styles.progressTrack, { width: `${progress * 100}%` }]} />

          {/* Seek Thumb */}
          <View style={[styles.thumb, { left: `${progress * 100}%` }]}>
            <View style={[styles.thumbInner, seeking && styles.thumbSeeking]} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  bufferedTrack: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#c0c0c0',
    borderRadius: 2,
  },
  progressTrack: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    top: -10, // Center vertically on track
    marginLeft: -12, // Center horizontally
  },
  thumbInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  thumbSeeking: {
    width: 20,
    height: 20,
    borderRadius: 10,
    transform: [{ scale: 1.2 }],
  },
});