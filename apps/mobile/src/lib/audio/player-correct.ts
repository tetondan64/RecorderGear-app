import { useState, useCallback, useRef, useMemo } from 'react';
import { Audio } from 'expo-av';

export interface PlayerState {
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  error?: string;
}

/**
 * CORRECT PLAYER IMPLEMENTATION - Using expo-av to match our recording
 * This uses the same expo-av package that we're using for recording
 */
export function useCorrectAudioPlayer(onStateChange: (state: PlayerState) => void) {
  const [sound, setSound] = useState<Audio.Sound | undefined>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const statusUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  
  // Update ref when callback changes
  onStateChangeRef.current = onStateChange;

  const updateStatus = useCallback(async () => {
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = status.positionMillis || 0;
        const newDuration = status.durationMillis || 0;
        const newIsPlaying = status.isPlaying || false;

        setPosition(newPosition);
        setDuration(newDuration);
        setIsPlaying(newIsPlaying);

        onStateChangeRef.current({
          isLoaded: true,
          isPlaying: newIsPlaying,
          position: newPosition,
          duration: newDuration,
        });

        // If playing, continue polling for updates
        if (newIsPlaying) {
          statusUpdateTimer.current = setTimeout(updateStatus, 100) as any;
        }
      }
    } catch (error) {
      console.error('CORRECT PLAYER: Error getting status:', error);
    }
  }, [sound]); // Removed onStateChange from dependencies

  const loadAudio = useCallback(async (uri: string) => {
    try {
      console.log('CORRECT PLAYER: Loading audio from:', uri);

      // Unload any existing sound
      if (sound) {
        await sound.unloadAsync();
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false, // Disable recording during playback
      });

      // Create and load sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { 
          shouldPlay: false,
          isLooping: false,
          volume: 1.0,
        }
      );

      setSound(newSound);
      setIsLoaded(true);

      // Get initial status
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        const initialDuration = status.durationMillis || 0;
        setDuration(initialDuration);
        setPosition(0);
        setIsPlaying(false);

        onStateChangeRef.current({
          isLoaded: true,
          isPlaying: false,
          position: 0,
          duration: initialDuration,
        });
      }

      console.log('CORRECT PLAYER: Audio loaded successfully');
    } catch (error) {
      console.error('CORRECT PLAYER: Failed to load audio:', error);
      onStateChangeRef.current({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: 'Failed to load audio file',
      });
      throw error;
    }
  }, [sound]); // Removed onStateChange from dependencies

  const play = useCallback(async () => {
    if (!sound) throw new Error('No sound loaded');

    try {
      console.log('CORRECT PLAYER: Playing audio');
      await sound.playAsync();
      setIsPlaying(true);
      
      // Start status updates
      updateStatus();
      
    } catch (error) {
      console.error('CORRECT PLAYER: Failed to play:', error);
      throw error;
    }
  }, [sound, updateStatus]);

  const pause = useCallback(async () => {
    if (!sound) throw new Error('No sound loaded');

    try {
      console.log('CORRECT PLAYER: Pausing audio');
      await sound.pauseAsync();
      setIsPlaying(false);
      
      // Stop status updates
      if (statusUpdateTimer.current) {
        clearTimeout(statusUpdateTimer.current);
        statusUpdateTimer.current = null;
      }
      
    } catch (error) {
      console.error('CORRECT PLAYER: Failed to pause:', error);
      throw error;
    }
  }, [sound]);

  const stop = useCallback(async () => {
    if (!sound) throw new Error('No sound loaded');

    try {
      console.log('CORRECT PLAYER: Stopping audio');
      await sound.stopAsync();
      setIsPlaying(false);
      setPosition(0);
      
      // Stop status updates
      if (statusUpdateTimer.current) {
        clearTimeout(statusUpdateTimer.current);
        statusUpdateTimer.current = null;
      }

      onStateChangeRef.current({
        isLoaded: true,
        isPlaying: false,
        position: 0,
        duration,
      });
      
    } catch (error) {
      console.error('CORRECT PLAYER: Failed to stop:', error);
      throw error;
    }
  }, [sound, duration]); // Removed onStateChange from dependencies

  const seekTo = useCallback(async (positionMillis: number) => {
    if (!sound) throw new Error('No sound loaded');

    try {
      console.log('CORRECT PLAYER: Seeking to:', positionMillis);
      await sound.setPositionAsync(positionMillis);
      setPosition(positionMillis);

      onStateChangeRef.current({
        isLoaded: true,
        isPlaying,
        position: positionMillis,
        duration,
      });
      
    } catch (error) {
      console.error('CORRECT PLAYER: Failed to seek:', error);
      throw error;
    }
  }, [sound, isPlaying, duration]); // Removed onStateChange from dependencies

  const dispose = useCallback(async () => {
    try {
      console.log('CORRECT PLAYER: Disposing player');
      
      // Stop status updates
      if (statusUpdateTimer.current) {
        clearTimeout(statusUpdateTimer.current);
        statusUpdateTimer.current = null;
      }

      // Unload sound
      if (sound) {
        await sound.unloadAsync();
        setSound(undefined);
      }

      // Reset state
      setIsLoaded(false);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);

      onStateChangeRef.current({
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
      });

    } catch (error) {
      console.error('CORRECT PLAYER: Error disposing player:', error);
    }
  }, [sound]); // Removed onStateChange from dependencies

  return useMemo(() => ({
    loadAudio,
    play,
    pause,
    stop,
    seekTo,
    dispose,
    isLoaded,
    isPlaying,
    position,
    duration,
  }), [loadAudio, play, pause, stop, seekTo, dispose, isLoaded, isPlaying, position, duration]);
}