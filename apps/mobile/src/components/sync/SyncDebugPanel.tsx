import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
// Import types only, use dynamic imports for instances
import { useTheme } from '../../hooks/useTheme';

/**
 * Debug panel for Phase C4 sync development and testing
 * Shows detailed sync state, cursor info, and debug controls
 */
export function SyncDebugPanel() {
  const theme = useTheme();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadDebugInfo = async () => {
    try {
      setRefreshing(true);
      
      // Dynamic imports to avoid circular dependency issues
      const { syncManager } = await import('../../lib/sync/syncManager');
      const { CursorStore } = await import('../../lib/sync/cursorStore');
      
      const [status, config, cursorState, shouldSyncResult] = await Promise.all([
        syncManager.getStatus(),
        Promise.resolve(syncManager.getConfiguration()),
        CursorStore.getCursorState(),
        syncManager.shouldSync()
      ]);

      setDebugInfo({
        status,
        config,
        cursorState,
        shouldSyncResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('SyncDebugPanel: Failed to load debug info:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDebugInfo();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadDebugInfo, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleTestSync = async () => {
    Alert.alert(
      'Test Sync',
      'Choose a sync trigger to test:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Manual', 
          onPress: async () => {
            try {
              const { syncManager } = await import('../../lib/sync/syncManager');
              await syncManager.syncNow();
            } catch (err: any) {
              Alert.alert('Sync Failed', err.message);
            }
          }
        },
        { 
          text: 'App Start', 
          onPress: async () => {
            try {
              const { syncManager } = await import('../../lib/sync/syncManager');
              await syncManager.syncOnAppStart();
            } catch (err: any) {
              Alert.alert('Sync Failed', err.message);
            }
          }
        },
        { 
          text: 'Foreground', 
          onPress: async () => {
            try {
              const { syncManager } = await import('../../lib/sync/syncManager');
              await syncManager.syncOnForeground();
            } catch (err: any) {
              Alert.alert('Sync Failed', err.message);
            }
          }
        }
      ]
    );
  };

  const handleClearCursor = () => {
    Alert.alert(
      'Clear Cursor',
      'This will reset the sync cursor to start from beginning. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { CursorStore } = await import('../../lib/sync/cursorStore');
              await CursorStore.clear();
              await loadDebugInfo();
              Alert.alert('Success', 'Cursor cleared');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const formatJson = (obj: any) => JSON.stringify(obj, null, 2);

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.spacing.sm,
      marginVertical: theme.spacing.sm
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text.primary
        }}>
          Sync Debug Panel
        </Text>
        
        <Pressable
          style={{
            backgroundColor: theme.colors.accent.primary,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.spacing.xs
          }}
          onPress={loadDebugInfo}
          disabled={refreshing}
        >
          <Text style={{
            color: theme.colors.text.onPrimary,
            fontSize: 12,
            fontWeight: '500'
          }}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {/* Action Buttons */}
      <View style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.md,
        flexWrap: 'wrap'
      }}>
        <Pressable
          style={{
            backgroundColor: theme.colors.success,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.spacing.xs
          }}
          onPress={handleTestSync}
        >
          <Text style={{
            color: theme.colors.text.onPrimary,
            fontSize: 14,
            fontWeight: '500'
          }}>
            Test Sync
          </Text>
        </Pressable>

        <Pressable
          style={{
            backgroundColor: theme.colors.warning,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.spacing.xs
          }}
          onPress={handleClearCursor}
        >
          <Text style={{
            color: theme.colors.text.onPrimary,
            fontSize: 14,
            fontWeight: '500'
          }}>
            Clear Cursor
          </Text>
        </Pressable>
      </View>

      {/* Debug Info */}
      <ScrollView 
        style={{ 
          maxHeight: 400,
          backgroundColor: theme.colors.background.secondary,
          borderRadius: theme.spacing.xs,
          padding: theme.spacing.sm
        }}
        showsVerticalScrollIndicator={true}
      >
        {Object.keys(debugInfo).length > 0 ? (
          <View>
            {/* Status */}
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.xs
            }}>
              Status:
            </Text>
            <Text style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              fontFamily: 'monospace',
              marginBottom: theme.spacing.md
            }}>
              {formatJson(debugInfo.status)}
            </Text>

            {/* Config */}
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.xs
            }}>
              Configuration:
            </Text>
            <Text style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              fontFamily: 'monospace',
              marginBottom: theme.spacing.md
            }}>
              {formatJson(debugInfo.config)}
            </Text>

            {/* Cursor State */}
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.xs
            }}>
              Cursor State:
            </Text>
            <Text style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              fontFamily: 'monospace',
              marginBottom: theme.spacing.md
            }}>
              {formatJson(debugInfo.cursorState)}
            </Text>

            {/* Should Sync */}
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.xs
            }}>
              Should Sync:
            </Text>
            <Text style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              fontFamily: 'monospace',
              marginBottom: theme.spacing.sm
            }}>
              {formatJson(debugInfo.shouldSyncResult)}
            </Text>

            {/* Timestamp */}
            <Text style={{
              fontSize: 11,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: theme.spacing.sm
            }}>
              Last updated: {debugInfo.timestamp}
            </Text>
          </View>
        ) : (
          <Text style={{
            color: theme.colors.text.secondary,
            textAlign: 'center',
            padding: theme.spacing.lg
          }}>
            Loading debug information...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}