import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useSearch } from '../../lib/store/search';
import { ActionSheet, ActionSheetOption } from '../common/ActionSheet';
import { SortBy, SortDir } from '../../lib/fs/settingsStore';

interface SortSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SortSheet({ visible, onClose }: SortSheetProps) {
  const { theme } = useTheme();
  const { sortBy, sortDir, setSortBy, setSortDir } = useSearch();
  
  const sortOptions: { key: SortBy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'CREATED_AT', label: 'Date Created', icon: 'calendar' },
    { key: 'UPDATED_AT', label: 'Date Updated', icon: 'create' },
    { key: 'DURATION', label: 'Duration', icon: 'time' },
  ];
  
  const handleSortByChange = (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    onClose();
  };
  
  const handleSortDirToggle = () => {
    setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
  };
  
  const options: ActionSheetOption[] = sortOptions.map((option) => ({
    id: option.key,
    title: option.label,
    icon: option.icon,
    onPress: () => handleSortByChange(option.key),
  }));
  
  return (
    <ActionSheet
      visible={visible}
      title="Sort recordings by"
      options={options}
      onCancel={onClose}
    />
  );
}

// Inline sort controls component for use in drawer
interface SortControlsProps {
  style?: any;
}

export function SortControls({ style }: SortControlsProps) {
  const { theme } = useTheme();
  const { sortBy, sortDir, setSortBy, toggleSortDir } = useSearch();
  
  const sortOptions = [
    { key: 'CREATED_AT', label: 'Date Created', icon: 'calendar' },
    { key: 'UPDATED_AT', label: 'Date Updated', icon: 'create' },
    { key: 'DURATION', label: 'Duration', icon: 'time' },
  ] as const;
  
  const currentSort = sortOptions.find(opt => opt.key === sortBy);
  
  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    title: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    directionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
      backgroundColor: theme.colors.background,
    },
    directionText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.medium,
      marginRight: theme.spacing.xs,
    },
    sortOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    sortOptionActive: {
      backgroundColor: theme.colors.primary + '15',
      borderColor: theme.colors.primary,
    },
    sortOptionIcon: {
      marginRight: theme.spacing.xs,
    },
    sortOptionText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.text,
      fontWeight: theme.typography.weights.medium,
    },
    sortOptionTextActive: {
      color: theme.colors.primary,
    },
  });
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sort By</Text>
        <TouchableOpacity 
          style={styles.directionButton}
          onPress={toggleSortDir}
          accessibilityLabel={`Sort direction: ${sortDir === 'ASC' ? 'Ascending' : 'Descending'}`}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
        >
          <Text style={styles.directionText}>
            {sortDir === 'ASC' ? 'A-Z' : 'Z-A'}
          </Text>
          <Ionicons 
            name={sortDir === 'ASC' ? 'arrow-up' : 'arrow-down'} 
            size={14} 
            color={theme.colors.primary} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.sortOptions}>
        {sortOptions.map((option) => {
          const isActive = sortBy === option.key;
          
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                isActive && styles.sortOptionActive
              ]}
              onPress={() => setSortBy(option.key)}
              accessibilityLabel={`Sort by ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons 
                name={option.icon} 
                size={16} 
                color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.sortOptionIcon}
              />
              <Text style={[
                styles.sortOptionText,
                isActive && styles.sortOptionTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}