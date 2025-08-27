import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Tag } from '../../lib/fs/metaStore';

interface TagChipsProps {
  activeTags: Tag[];
  onTagRemove: (tagId: string) => void;
  onClearAll?: () => void;
  style?: any;
}

export function TagChips({ activeTags, onTagRemove, onClearAll, style }: TagChipsProps) {
  const { theme } = useTheme();

  if (activeTags.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    scrollView: {
      flexGrow: 0,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    label: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.weights.medium,
      marginRight: theme.spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary + '15',
      borderRadius: 16,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginRight: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    chipText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.medium,
      marginRight: theme.spacing.xs,
    },
    removeButton: {
      padding: 2,
      borderRadius: 10,
      backgroundColor: theme.colors.primary + '20',
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.error + '15',
      borderRadius: 16,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
    },
    clearButtonText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.error,
      fontWeight: theme.typography.weights.medium,
      marginRight: theme.spacing.xs,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.label}>Tags:</Text>
        
        {activeTags.map((tag) => (
          <View key={tag.id} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {tag.name}
            </Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onTagRemove(tag.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tag.name} filter`}
            >
              <Ionicons name="close" size={12} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        ))}

        {activeTags.length > 1 && onClearAll && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel="Clear all tag filters"
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
            <Ionicons name="close-circle" size={16} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}