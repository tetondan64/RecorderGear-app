import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useRecordings } from '../../src/lib/store/recordings';
import { useFolders } from '../../src/lib/store/folders';
import { useTags } from '../../src/lib/store/tags';
import { useSearch } from '../../src/lib/store/search';
import { formatDuration, formatTimestamp } from '../../src/lib/utils/format';
import type { RecordingEntry } from '../../src/lib/fs/indexStore';
import { FilterDrawer } from '../../src/components/drawer/FilterDrawer';
import { FolderBreadcrumb } from '../../src/components/library/FolderBreadcrumb';
import { TagChips } from '../../src/components/library/TagChips';
import { Highlight } from '../../src/components/library/Highlight';
import { SyncBadge } from '../../src/components/library/SyncBadge';
import type { SyncStatus } from '../../src/lib/sync/types';
import { SyncStatusIndicator } from '../../src/components/library/SyncStatusIndicator';
import { Toast } from '../../src/components/common/Toast';
import { syncManager } from '../../src/lib/sync/SyncManager';

interface RecordingItemProps {
  recording: RecordingEntry;
  onPress: (recording: RecordingEntry) => void;
  onLongPress: (recording: RecordingEntry) => void;
  searchQuery: string;
  syncStatus: SyncStatus;
  syncProgress?: number;
}

function RecordingItem({ recording, onPress, onLongPress, searchQuery, syncStatus, syncProgress }: RecordingItemProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    item: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.md,
      marginVertical: theme.spacing.xs,
      borderRadius: 12,
      padding: theme.spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.sm,
    },
    titleContainer: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    title: {
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textSecondary,
    },
    metadata: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    duration: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.primary,
    },
    playIcon: {
      marginRight: theme.spacing.sm,
    },
  });

  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(recording)}
      onLongPress={() => onLongPress(recording)}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Highlight
            text={recording.title}
            query={searchQuery}
            style={styles.title}
          />
          <Text style={styles.subtitle}>
            {formatTimestamp(recording.createdAt)}
          </Text>
        </View>
        <Ionicons
          name="play-circle-outline"
          size={24}
          color={theme.colors.primary}
          style={styles.playIcon}
        />
      </View>

      <View style={styles.metadata}>
        <Text style={styles.duration}>
          {formatDuration(recording.durationSec)}
        </Text>
        <SyncBadge 
          status={syncStatus} 
          size="small" 
          showText={false}
          progress={syncProgress}
        />
      </View>
    </TouchableOpacity>
  );
}


export default function LibraryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { 
    recordings, 
    loading, 
    refresh, 
    filters,
    filteredAndSortedRecordings,
    setFolderFilter,
    toggleTagFilter,
    clearFilters 
  } = useRecordings();
  
  // Sync state
  const [syncProgress, setSyncProgress] = useState<Map<string, number>>(new Map());
  
  const { query } = useSearch();
  
  const { getFolder, getFolderPath } = useFolders();
  const { getTagsByIds } = useTags();
  
  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Initialize sync manager on mount
  React.useEffect(() => {
    initializeSyncManager();
  }, []);

  const initializeSyncManager = async () => {
    await syncManager.initialize();
    
    // Listen to sync events
    syncManager.on('started', (data) => {
      if (data.progress !== undefined) {
        setSyncProgress(prev => new Map(prev.set(data.recordingId, data.progress!)));
      }
    });
    
    syncManager.on('completed', (data) => {
      setSyncProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.recordingId);
        return newMap;
      });
      Toast.success('Recording synced to cloud');
    });
    
    syncManager.on('failed', (data) => {
      setSyncProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.recordingId);
        return newMap;
      });
      Toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
    });
  };

  // Use memoized filtered and sorted recordings from store
  const filteredRecordings = filteredAndSortedRecordings;
  
  const folderPath = useMemo(() => {
    return filters.folderId ? getFolderPath(filters.folderId) : [];
  }, [filters.folderId, getFolderPath]);
  
  const activeTags = useMemo(() => {
    return getTagsByIds(filters.tagIds);
  }, [filters.tagIds, getTagsByIds]);

  // Handlers
  const handleRecordingPress = (recording: RecordingEntry) => {
    router.push(`/recording/${recording.id}`);
  };

  const handleOpenDrawer = useCallback(() => {
    setDrawerVisible(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);

  const handleFolderNavigation = useCallback((folderId: string | null) => {
    setFolderFilter(folderId);
  }, [setFolderFilter]);

  const handleTagRemove = useCallback((tagId: string) => {
    toggleTagFilter(tagId);
  }, [toggleTagFilter]);

  const handleClearAllTags = useCallback(() => {
    // Clear only tag filters, keep folder filter
    filters.tagIds.forEach(tagId => toggleTagFilter(tagId));
  }, [filters.tagIds, toggleTagFilter]);

  const handleRecordingLongPress = useCallback((recording: RecordingEntry) => {
    const syncStatus = getSyncStatus(recording);
    const options: any[] = [];

    // Add retry option for failed syncs
    if (syncStatus === 'failed') {
      options.push({
        text: 'Retry Sync',
        onPress: () => handleRetrySync(recording),
      });
    }

    // Add manual sync option for local-only recordings
    if (syncStatus === 'local') {
      options.push({
        text: 'Sync to Cloud',
        onPress: () => handleManualSync(recording),
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    if (options.length > 1) {
      Alert.alert(
        'Recording Options',
        `"${recording.title}"`,
        options
      );
    }
  }, []);

  const handleRetrySync = useCallback(async (recording: RecordingEntry) => {
    try {
      // For now, just trigger a general sync
      await syncManager.syncNow();
      Toast.info('Retrying sync...');
    } catch (error: any) {
      Toast.error(`Failed to retry sync: ${error.message}`);
    }
  }, []);

  const handleManualSync = useCallback(async (recording: RecordingEntry) => {
    try {
      // For now, just trigger a general sync
      await syncManager.syncNow();
      Toast.info('Starting sync...');
    } catch (error: any) {
      Toast.error(`Failed to start sync: ${error.message}`);
    }
  }, []);

  const getSyncStatus = useCallback((recording: RecordingEntry): SyncStatus => {
    // Default to 'local' for now - individual recording sync status not implemented yet
    return 'local';
  }, []);

  const getSyncProgress = useCallback((recording: RecordingEntry): number | undefined => {
    return syncProgress.get(recording.id);
  }, [syncProgress]);

  const renderItem = ({ item }: { item: RecordingEntry }) => (
    <RecordingItem 
      recording={item} 
      onPress={handleRecordingPress}
      onLongPress={handleRecordingLongPress}
      searchQuery={query}
      syncStatus={getSyncStatus(item)}
      syncProgress={getSyncProgress(item)}
    />
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top, // Use safe area insets instead of SafeAreaView
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md, // Reduced since we handle safe area in container
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    drawerButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: theme.typography.sizes.xxxl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
    },
    spacer: {
      width: 32, // Match drawer button width for perfect centering
      height: 32,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    emptyText: {
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
  });

  // Show empty state for no recordings at all, or no filtered results
  const showEmptyState = recordings.length === 0 || filteredRecordings.length === 0;
  const emptyMessage = recordings.length === 0 
    ? "No recordings yet.\nStart recording to see your files here!" 
    : "No recordings match your filters.\nTry adjusting your folder or tag selection.";
  const emptyIcon = recordings.length === 0 ? "musical-notes-outline" : "search-outline";

  if (showEmptyState) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.drawerButton}
            onPress={handleOpenDrawer}
            testID="open-filter-drawer"
            accessibilityRole="button"
            accessibilityLabel="Open filters and folders"
          >
            <Ionicons name="menu-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Library</Text>
          </View>
          
          <View style={styles.spacer} />
        </View>

        {/* Show breadcrumb and tags even in empty state if filters are active */}
        {folderPath.length > 0 && (
          <FolderBreadcrumb 
            folderPath={folderPath}
            onFolderPress={handleFolderNavigation}
          />
        )}

        {activeTags.length > 0 && (
          <TagChips 
            activeTags={activeTags}
            onTagRemove={handleTagRemove}
            onClearAll={handleClearAllTags}
          />
        )}

        <View style={styles.emptyContainer}>
          <Ionicons
            name={emptyIcon}
            size={64}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            {emptyMessage}
          </Text>
        </View>

        {/* Filter Drawer in empty state too */}
        <FilterDrawer 
          visible={drawerVisible}
          onClose={handleCloseDrawer}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.drawerButton}
          onPress={handleOpenDrawer}
          testID="open-filter-drawer"
          accessibilityRole="button"
          accessibilityLabel="Open filters and folders"
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Library</Text>
          <SyncStatusIndicator />
        </View>
        
        <View style={styles.spacer} />
      </View>

      {/* Folder breadcrumb navigation */}
      {folderPath.length > 0 && (
        <FolderBreadcrumb 
          folderPath={folderPath}
          onFolderPress={handleFolderNavigation}
        />
      )}

      {/* Active tag filters */}
      {activeTags.length > 0 && (
        <TagChips 
          activeTags={activeTags}
          onTagRemove={handleTagRemove}
          onClearAll={handleClearAllTags}
        />
      )}

      <FlatList
        data={filteredRecordings}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* Filter Drawer */}
      <FilterDrawer 
        visible={drawerVisible}
        onClose={handleCloseDrawer}
      />
    </View>
  );
}
