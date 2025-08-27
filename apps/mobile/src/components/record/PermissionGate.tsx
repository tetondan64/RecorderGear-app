import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PermissionsManager, PermissionStatus, PermissionResult } from '../../lib/permissions';

interface PermissionGateProps {
  children: React.ReactNode;
}

export function PermissionGate({ children }: PermissionGateProps) {
  const [permission, setPermission] = useState<PermissionResult>({
    status: PermissionStatus.UNDETERMINED,
    canAskAgain: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    setIsLoading(true);
    try {
      const result = await PermissionsManager.getRecordingPermission();
      setPermission(result);
    } catch (error) {
      console.error('Failed to check permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    try {
      const result = await PermissionsManager.requestRecordingPermission();
      setPermission(result);
      
      if (result.status === PermissionStatus.DENIED && !result.canAskAgain) {
        Alert.alert(
          'Permission Required',
          'Microphone access is required to record audio. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
      Alert.alert('Error', 'Failed to request microphone permission');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Ionicons name="mic" size={64} color="#ccc" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  if (permission.status === PermissionStatus.GRANTED) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Ionicons 
        name="mic-off" 
        size={64} 
        color={permission.status === PermissionStatus.DENIED ? '#ff4444' : '#ffa500'} 
      />
      
      <Text style={styles.title}>
        {permission.status === PermissionStatus.DENIED 
          ? 'Microphone Access Denied' 
          : 'Microphone Permission Required'
        }
      </Text>
      
      <Text style={styles.description}>
        {permission.status === PermissionStatus.DENIED
          ? permission.canAskAgain
            ? 'Please grant microphone access to record audio.'
            : 'Microphone access was denied. Enable it in Settings to continue.'
          : 'This app needs access to your microphone to record audio.'
        }
      </Text>

      {permission.canAskAgain ? (
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
      )}

      {permission.canAskAgain && (
        <TouchableOpacity style={styles.retryButton} onPress={checkPermission}>
          <Text style={styles.retryText}>Check Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    color: '#666',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 12,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 16,
  },
});