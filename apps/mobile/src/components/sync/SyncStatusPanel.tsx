import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import type { SyncStatus, SyncConfiguration } from '../../lib/sync/syncManager';
import { useTheme } from '../../hooks/useTheme';

interface SyncStatusPanelProps {
  showAdvanced?: boolean;
}

/**
 * Sync Status Panel for Phase C4 Multi-Device Sync
 * Shows sync status, provides manual sync trigger, and configuration controls
 */
export function SyncStatusPanel({ showAdvanced = false }: SyncStatusPanelProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [config, setConfig] = useState<SyncConfiguration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initialize = async () => {
      try {
        // Dynamic import to avoid circular dependency issues
        const { syncManager } = await import('../../lib/sync/syncManager');
        
        // Get initial status and config
        const [initialStatus, initialConfig] = await Promise.all([
          syncManager.getStatus(),
          Promise.resolve(syncManager.getConfiguration())
        ]);
        
        setStatus(initialStatus);
        setConfig(initialConfig);
        setLoading(false);

        // Subscribe to status updates
        unsubscribe = syncManager.subscribe((newStatus) => {
          setStatus(newStatus);
        });
      } catch (error) {
        console.error('SyncStatusPanel: Failed to initialize:', error);
        setLoading(false);
      }
    };

    initialize();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleSyncNow = async () => {
    if (!status?.isEnabled) {
      Alert.alert('Sync Disabled', 'Sync is currently disabled. Enable sync first.');
      return;
    }

    if (status.isRunning) {
      Alert.alert('Sync In Progress', 'Sync is already running. Please wait for it to complete.');
      return;
    }

    try {
      const { syncManager } = await import('../../lib/sync/syncManager');
      await syncManager.syncNow();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to start sync');
    }
  };

  const handleToggleSync = async () => {
    if (!status || !config) return;

    try {
      const { syncManager } = await import('../../lib/sync/syncManager');
      if (status.isEnabled) {
        await syncManager.disableSync();
      } else {
        await syncManager.enableSync();
      }
      // Status will update via subscription
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to toggle sync');
    }
  };

  const handleResetSync = () => {
    Alert.alert(
      'Reset Sync State',
      'This will clear all sync history and start fresh. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const { syncManager } = await import('../../lib/sync/syncManager');
              await syncManager.resetSyncState();
              Alert.alert('Success', 'Sync state has been reset');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reset sync');
            }
          }
        }
      ]
    );
  };

  const formatLastSync = (lastSyncAt: Date | null): string => {
    if (!lastSyncAt) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSyncAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getStatusColor = (status: SyncStatus): string => {
    if (!status.isEnabled) return theme.colors.text.secondary;
    if (status.isRunning) return theme.colors.accent.primary;
    if (status.lastError) return theme.colors.danger;
    return theme.colors.success;
  };

  const getStatusText = (status: SyncStatus): string => {
    if (!status.isEnabled) return 'Disabled';
    if (status.isRunning) return 'Syncing...';
    if (status.lastError) return 'Error';
    return 'Ready';
  };

  if (loading) {
    return (
      <View style={{ padding: theme.spacing.md }}>
        <Text style={{ color: theme.colors.text.secondary }}>Loading sync status...</Text>
      </View>
    );
  }

  if (!status || !config) {
    return (
      <View style={{ padding: theme.spacing.md }}>
        <Text style={{ color: theme.colors.danger }}>Failed to load sync status</Text>
      </View>
    );
  }

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.spacing.sm,
      marginVertical: theme.spacing.sm
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.sm
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text.primary
        }}>
          Multi-Device Sync
        </Text>
        
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs
        }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: getStatusColor(status)
          }} />
          <Text style={{
            fontSize: 14,
            color: getStatusColor(status),
            fontWeight: '500'
          }}>
            {getStatusText(status)}
          </Text>
        </View>
      </View>

      {/* Status Info */}
      <View style={{ marginBottom: theme.spacing.sm }}>
        <Text style={{
          fontSize: 14,
          color: theme.colors.text.secondary,
          marginBottom: 2
        }}>
          Last sync: {formatLastSync(status.lastSyncAt)}
        </Text>
        
        {status.lastError && (
          <Text style={{
            fontSize: 13,
            color: theme.colors.danger,
            marginTop: 4
          }}>
            {status.lastError}
          </Text>
        )}
      </View>

      {/* Controls */}
      <View style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        flexWrap: 'wrap'
      }}>
        <Pressable
          style={{
            backgroundColor: status.isEnabled ? theme.colors.accent.primary : theme.colors.text.secondary,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.spacing.xs,
            opacity: status.isRunning ? 0.6 : 1
          }}
          onPress={handleSyncNow}
          disabled={!status.isEnabled || status.isRunning}
        >
          <Text style={{
            color: theme.colors.text.onPrimary,
            fontSize: 14,
            fontWeight: '500'
          }}>
            {status.isRunning ? 'Syncing...' : 'Sync Now'}
          </Text>
        </Pressable>

        <Pressable
          style={{
            backgroundColor: 'transparent',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.spacing.xs,
            borderWidth: 1,
            borderColor: theme.colors.border.primary
          }}
          onPress={handleToggleSync}
          disabled={status.isRunning}
        >
          <Text style={{
            color: theme.colors.text.primary,
            fontSize: 14,
            fontWeight: '500'
          }}>
            {status.isEnabled ? 'Disable' : 'Enable'}
          </Text>
        </Pressable>
      </View>

      {/* Advanced Controls */}
      {showAdvanced && (
        <View style={{ marginTop: theme.spacing.md }}>
          <View style={{
            height: 1,
            backgroundColor: theme.colors.border.secondary,
            marginBottom: theme.spacing.sm
          }} />
          
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.xs
          }}>
            Advanced
          </Text>
          
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{
              fontSize: 13,
              color: theme.colors.text.secondary
            }}>
              Budget: {config.maxPages} pages, {config.maxDurationMs}ms timeout
            </Text>
            
            <Text style={{
              fontSize: 13,
              color: theme.colors.text.secondary
            }}>
              Staleness: {config.staleness} minutes
            </Text>
            
            <Text style={{
              fontSize: 13,
              color: theme.colors.text.secondary
            }}>
              Page limit: {config.pageLimit} items
            </Text>
          </View>

          <Pressable
            style={{
              marginTop: theme.spacing.sm,
              paddingVertical: theme.spacing.xs
            }}
            onPress={handleResetSync}
            disabled={status.isRunning}
          >
            <Text style={{
              color: theme.colors.danger,
              fontSize: 14,
              fontWeight: '500'
            }}>
              Reset Sync State
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}