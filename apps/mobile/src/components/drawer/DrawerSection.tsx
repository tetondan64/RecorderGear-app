import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface DrawerSectionProps {
  title: string;
  children: React.ReactNode;
  style?: any;
}

export function DrawerSection({ title, children, style }: DrawerSectionProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    header: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    content: {
      paddingTop: theme.spacing.xs,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}