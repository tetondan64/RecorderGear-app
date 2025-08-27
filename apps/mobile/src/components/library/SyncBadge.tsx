import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

/**
 * Sync status badge component
 * Shows sync status with accessibility support
 */

import type { SyncStatus } from '../../lib/sync/types';

export interface SyncBadgeProps {
  status: SyncStatus;
  size?: 'small' | 'medium';
  showText?: boolean;
  progress?: number; // 0-100 for upload progress
}

export function SyncBadge({ status, size = 'medium', showText = true, progress }: SyncBadgeProps) {
  const { theme } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: 'cloud-done' as const,
          color: '#10B981', // Green
          text: 'Synced',
          backgroundColor: '#ECFDF5',
          accessibilityLabel: 'Cloud status: synced',
        };
      case 'uploading':
        return {
          icon: 'cloud-upload' as const,
          color: '#F59E0B', // Yellow/Orange
          text: progress !== undefined ? `${Math.round(progress)}%` : 'Uploading...',
          backgroundColor: '#FFFBEB',
          accessibilityLabel: progress !== undefined 
            ? `Cloud status: uploading ${Math.round(progress)}%` 
            : 'Cloud status: uploading',
        };
      case 'queued':
        return {
          icon: 'time' as const,
          color: '#6B7280', // Gray
          text: 'Queued',
          backgroundColor: '#F9FAFB',
          accessibilityLabel: 'Cloud status: queued',
        };
      case 'failed':
        return {
          icon: 'cloud-offline' as const,
          color: '#EF4444', // Red
          text: 'Failed',
          backgroundColor: '#FEF2F2',
          accessibilityLabel: 'Cloud status: failed',
        };
      case 'local':
        return {
          icon: 'phone-portrait' as const,
          color: theme.colors.textSecondary || '#666',
          text: 'Local',
          backgroundColor: theme.colors.surface || '#f5f5f5',
          accessibilityLabel: 'Cloud status: local only',
        };
      default:
        // Fallback for any unexpected status values
        return {
          icon: 'help-circle' as const,
          color: theme.colors.textSecondary || '#666',
          text: 'Unknown',
          backgroundColor: theme.colors.surface || '#f5f5f5',
          accessibilityLabel: 'Cloud status: unknown',
        };
    }
  };

  const config = getStatusConfig();
  const isSmall = size === 'small';

  if (status === 'local') {
    return null; // Don't show badge for local-only recordings
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmall ? theme.spacing.xs : theme.spacing.sm,
      paddingVertical: isSmall ? 2 : theme.spacing.xs,
      borderRadius: isSmall ? 8 : 12,
      backgroundColor: config.backgroundColor,
    },
    icon: {
      marginRight: showText ? (isSmall ? theme.spacing.xs : theme.spacing.sm) : 0,
    },
    text: {
      fontSize: isSmall ? theme.typography.sizes.xs : theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: config.color,
    },
  });

  return (
    <View 
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={config.accessibilityLabel}
    >
      <Ionicons 
        name={config.icon} 
        size={isSmall ? 12 : 16} 
        color={config.color}
        style={styles.icon}
      />
      {showText && (
        <Text style={styles.text}>
          {config.text}
        </Text>
      )}
    </View>
  );
}