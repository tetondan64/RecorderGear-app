import { useAudioPlayer, AudioStatus } from 'expo-audio';
import { HapticsManager } from '../haptics';
import { useCallback, useEffect, useState } from 'react';

export interface PlayerState {
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  error?: string;
}

export function useAudioPlayerManager(onStateChange: (state: PlayerState) => void) {
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoaded: false,
    isPlaying: false,
    position: 0,
    duration: 0,
  });

  const player = useAudioPlayer(currentUri || undefined);

  // Update state when player status changes
  useEffect(() => {
    const updateState = (status: AudioStatus) => {
      const newState: PlayerState = {
        isLoaded: status.isLoaded,
        isPlaying: status.playing,
        position: status.currentTime * 1000, // Convert to milliseconds
        duration: status.duration * 1000, // Convert to milliseconds
      };

      setPlayerState(newState);
      onStateChange(newState);
    };

    if (player && currentUri) {
      // Get initial status
      updateState(player.currentStatus);
      
      // Set up status listener if needed
      const listener = player.addListener('playbackStatusUpdate', updateState);
      
      return () => {
        listener?.remove();
      };
    }
  }, [player, currentUri, onStateChange]);

  const loadAudio = useCallback(async (uri: string) => {
    try {
      setCurrentUri(uri);
      
      const newState: PlayerState = {
        isLoaded: true,
        isPlaying: false,
        position: 0,
        duration: 0,
      };
      
      setPlayerState(newState);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to load audio:', error);
      const errorState: PlayerState = {
        isLoaded: false,
        isPlaying: false,
        position: 0,
        duration: 0,
        error: 'Failed to load audio',
      };
      
      setPlayerState(errorState);
      onStateChange(errorState);
    }
  }, [onStateChange]);

  const play = useCallback(async () => {
    if (!player) {
      throw new Error('No audio loaded');
    }

    try {
      player.play();
      await HapticsManager.playToggle();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw new Error('Failed to play audio');
    }
  }, [player]);

  const pause = useCallback(async () => {
    if (!player) {
      throw new Error('No audio loaded');
    }

    try {
      player.pause();
      await HapticsManager.playToggle();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      throw new Error('Failed to pause audio');
    }
  }, [player]);

  const seekTo = useCallback(async (positionMillis: number) => {
    if (!player) {
      throw new Error('No audio loaded');
    }

    try {
      const positionSeconds = positionMillis / 1000;
      await player.seekTo(positionSeconds);
    } catch (error) {
      console.error('Failed to seek audio:', error);
      throw new Error('Failed to seek audio');
    }
  }, [player]);

  const stop = useCallback(async () => {
    if (!player) {
      return;
    }

    try {
      player.pause();
      await player.seekTo(0);
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  }, [player]);

  const dispose = useCallback(() => {
    if (player) {
      player.remove();
    }
    setCurrentUri(null);
    setPlayerState({
      isLoaded: false,
      isPlaying: false,
      position: 0,
      duration: 0,
    });
  }, [player]);

  return {
    loadAudio,
    play,
    pause,
    seekTo,
    stop,
    dispose,
    playerState,
  };
}