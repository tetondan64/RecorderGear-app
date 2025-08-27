import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Folder } from '../../lib/fs/metaStore';

interface FolderBreadcrumbProps {
  folderPath: Folder[];
  onFolderPress: (folderId: string | null) => void;
  style?: any;
}

export function FolderBreadcrumb({ folderPath, onFolderPress, style }: FolderBreadcrumbProps) {
  const { theme } = useTheme();

  if (folderPath.length === 0) {
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
    homeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
      backgroundColor: theme.colors.background,
    },
    homeText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.medium,
      marginLeft: theme.spacing.xs,
    },
    separator: {
      marginHorizontal: theme.spacing.sm,
    },
    folderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
      backgroundColor: theme.colors.background,
    },
    folderText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.text,
      fontWeight: theme.typography.weights.medium,
      marginLeft: theme.spacing.xs,
    },
    lastFolderText: {
      color: theme.colors.primary,
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
        {/* Home/All recordings button */}
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => onFolderPress(null)}
          accessibilityRole="button"
          accessibilityLabel="All recordings"
        >
          <Ionicons name="home-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.homeText}>All</Text>
        </TouchableOpacity>

        {/* Folder path */}
        {folderPath.map((folder, index) => {
          const isLast = index === folderPath.length - 1;
          
          return (
            <View key={folder.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.separator}>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={theme.colors.textSecondary} 
                />
              </View>
              
              <TouchableOpacity
                style={styles.folderButton}
                onPress={() => onFolderPress(folder.id)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${folder.name}`}
                disabled={isLast}
              >
                <Ionicons 
                  name={isLast ? "folder" : "folder-outline"} 
                  size={16} 
                  color={isLast ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text 
                  style={[
                    styles.folderText,
                    isLast && styles.lastFolderText
                  ]}
                  numberOfLines={1}
                >
                  {folder.name}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}