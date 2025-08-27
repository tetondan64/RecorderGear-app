import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface DrawerHandleProps {
  onClose: () => void;
}

export function DrawerHandle({ onClose }: DrawerHandleProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    title: {
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
  });

  return (
    <View style={styles.container}>
      <View />
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
        accessibilityLabel="Close filters"
        accessibilityRole="button"
      >
        <Ionicons 
          name="close" 
          size={24} 
          color={theme.colors.textSecondary} 
        />
      </TouchableOpacity>
    </View>
  );
}