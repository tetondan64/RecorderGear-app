import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface DrawerItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  count?: number;
  isActive?: boolean;
  isCreating?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onCreatePress?: () => void;
  showMenu?: boolean;
  onMenuPress?: () => void;
  style?: any;
}

export function DrawerItem({
  icon,
  title,
  count,
  isActive = false,
  isCreating = false,
  onPress,
  onLongPress,
  onCreatePress,
  showMenu = false,
  onMenuPress,
  style,
}: DrawerItemProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: isActive ? theme.colors.primary + '15' : 'transparent',
      borderRadius: isActive ? 8 : 0,
      marginHorizontal: isActive ? theme.spacing.xs : 0,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    icon: {
      marginRight: theme.spacing.sm,
    },
    textContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: theme.typography.sizes.md,
      color: isActive ? theme.colors.primary : theme.colors.text,
      fontWeight: isActive ? theme.typography.weights.medium : theme.typography.weights.regular,
    },
    count: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={isCreating}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        {icon && (
          <View style={styles.icon}>
            <Ionicons 
              name={icon} 
              size={20} 
              color={isActive ? theme.colors.primary : theme.colors.textSecondary} 
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {count !== undefined && (
            <Text style={styles.count}>({count})</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {onCreatePress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCreatePress}
            accessibilityLabel="Create new item"
            accessibilityRole="button"
          >
            <Ionicons 
              name="add" 
              size={20} 
              color={theme.colors.primary} 
            />
          </TouchableOpacity>
        )}
        
        {showMenu && onMenuPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onMenuPress}
            accessibilityLabel="Item options"
            accessibilityRole="button"
          >
            <Ionicons 
              name="ellipsis-horizontal" 
              size={20} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}