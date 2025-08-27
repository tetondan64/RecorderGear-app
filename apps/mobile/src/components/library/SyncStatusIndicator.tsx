import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { syncManager } from '../../lib/sync/syncManager';

export function SyncStatusIndicator() {
  const { theme } = useTheme();
  const [status, setStatus] = React.useState<any>({
    syncing: false,
    pendingCount: 0,
    errorCount: 0
  });

  React.useEffect(() => {
    const updateStatus = async () => {
      try {
        const { getSyncStatus } = await import('../../lib/sync/simpleIntegration');
        const syncStatus = await getSyncStatus();
        setStatus({
          syncing: syncStatus.isRunning,
          pendingCount: 0, // Phase C4 doesn't have pending count concept
          errorCount: syncStatus.lastError ? 1 : 0
        });
      } catch (error) {
        console.error('SyncStatusIndicator: Failed to get status:', error);
        setStatus({
          syncing: false,
          pendingCount: 0,
          errorCount: 1
        });
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const handlePress = async () => {
    // Could open sync status detail modal or retry sync
    if (status.errorCount > 0) {
      try {
        const { triggerManualSync } = await import('../../lib/sync/simpleIntegration');
        await triggerManualSync();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  const getStatusConfig = () => {
    if (status.errorCount > 0) {
      return {
        icon: 'alert-circle' as const,
        color: '#EF4444', // Red
        text: `${status.errorCount} failed`,
        backgroundColor: '#FEF2F2',
      };
    }
    
    if (status.syncing) {
      return {
        icon: 'cloud-upload' as const,
        color: '#F59E0B', // Orange
        text: `Syncing ${status.pendingCount}`,
        backgroundColor: '#FFFBEB',
      };
    }
    
    return {
      icon: 'cloud-done' as const,
      color: '#10B981', // Green
      text: 'Synced',
      backgroundColor: '#ECFDF5',
    };
  };

  // Don't show if no activity
  if (!status.syncing && status.errorCount === 0) {
    return null;
  }

  const config = getStatusConfig();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: config.backgroundColor,
      marginTop: theme.spacing.xs,
    },
    icon: {
      marginRight: theme.spacing.xs,
    },
    text: {
      fontSize: theme.typography.sizes.xs,
      fontWeight: theme.typography.weights.medium,
      color: config.color,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Ionicons 
        name={config.icon} 
        size={12} 
        color={config.color}
        style={styles.icon}
      />
      <Text style={styles.text}>
        {config.text}
      </Text>
    </TouchableOpacity>
  );
}