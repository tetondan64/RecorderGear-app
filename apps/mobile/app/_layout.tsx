import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '../src/hooks/useTheme';
import { ToastContainer } from '../src/components/common/Toast';

function RootContent() {
  const { theme, isDarkMode } = useTheme();

  // Initialize auto-sync integration on app startup
  useEffect(() => {
    const initializeSync = async () => {
      try {
        console.log('ROOT_LAYOUT: Initializing auto-sync integration...');
        const { initializeAutoSync } = await import('../src/lib/sync/simpleIntegration');
        await initializeAutoSync();
        console.log('ROOT_LAYOUT: Auto-sync integration initialized successfully');

        // Load debug utilities in development
        if (__DEV__) {
          await import('../src/lib/sync/debug');
        }
      } catch (error) {
        console.error('ROOT_LAYOUT: Failed to initialize auto-sync (non-blocking):', error);
        // Don't crash the app if sync initialization fails
      }
    };

    initializeSync();
  }, []);
  
  return (
    <>
      <StatusBar 
        style={isDarkMode ? "light" : "dark"} 
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <ToastContainer />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
