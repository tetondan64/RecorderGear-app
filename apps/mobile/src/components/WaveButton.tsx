import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface WaveButtonProps {
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  size?: number;
  isRecording?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function WaveButton({
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  size = 120,
  isRecording = false,
  disabled = false,
  style,
}: WaveButtonProps) {
  const { theme } = useTheme();
  const [_isPressed, setIsPressed] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation when recording
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Start wave animation
      const waveAnimation = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      pulseAnimation.start();
      waveAnimation.start();

      return () => {
        pulseAnimation.stop();
        waveAnimation.stop();
      };
    } else {
      pulseAnim.setValue(0);
      waveAnim.setValue(0);
    }
  }, [isRecording, pulseAnim, waveAnim]);

  const handlePressIn = () => {
    if (disabled) {return;}

    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    onPressIn?.();
  };

  const handlePressOut = () => {
    if (disabled) {return;}

    setIsPressed(false);

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    onPressOut?.();
  };

  const handlePress = () => {
    if (disabled) {return;}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleLongPress = () => {
    if (disabled) {return;}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLongPress?.();
  };

  const buttonColor = disabled
    ? theme.colors.textSecondary
    : isRecording
    ? theme.colors.error
    : theme.colors.primary;

  const iconName = isRecording ? 'stop' : 'mic';

  return (
    <View style={[styles.container, style]}>
      {/* Wave rings for recording state */}
      {isRecording && (
        <>
          {[0, 1, 2].map(index => (
            <Animated.View
              key={index}
              style={[
                styles.waveRing,
                {
                  width: size * 1.8,
                  height: size * 1.8,
                  borderColor: buttonColor,
                  opacity: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6 - index * 0.2, 0],
                  }),
                  transform: [
                    {
                      scale: waveAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1 + index * 0.2, 1.8 + index * 0.2],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </>
      )}

      {/* Main button */}
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            {
              width: size,
              height: size,
              backgroundColor: buttonColor,
              opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {/* Pulse overlay for recording */}
          {isRecording && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.pulseOverlay,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.3],
                  }),
                  backgroundColor: theme.colors.surface,
                },
              ]}
            />
          )}

          <Ionicons
            name={iconName}
            size={size * 0.4}
            color={theme.colors.surface}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  pulseOverlay: {
    borderRadius: 9999,
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
  },
});
