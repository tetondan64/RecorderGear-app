import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useFolders } from '../../lib/store/folders';
import { useTags } from '../../lib/store/tags';
import { useRecordings } from '../../lib/store/recordings';
import { useSearch } from '../../lib/store/search';
import { DrawerHandle } from './DrawerHandle';
import { DrawerSection } from './DrawerSection';
import { DrawerItem } from './DrawerItem';
import { TextField } from '../common/TextField';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ActionSheet, ActionSheetOption } from '../common/ActionSheet';
import { SearchBar } from '../library/SearchBar';
import { SortControls } from '../library/SortSheet';
import { MetaStore } from '../../lib/fs/metaStore';
import { SettingsStore } from '../../lib/fs/settingsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.86;
const BACKDROP_OPACITY = 0.4;

interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
}

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDestructive: boolean;
}

interface ActionSheetState {
  visible: boolean;
  title: string;
  options: ActionSheetOption[];
}

export function FilterDrawer({ visible, onClose }: FilterDrawerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Store hooks
  const { 
    folders, 
    loadFolders, 
    createFolder, 
    updateFolder, 
    deleteFolder, 
    getFoldersByParent,
    getFolderUsageCount 
  } = useFolders();
  
  const { 
    tags, 
    loadTags, 
    createTag, 
    updateTag, 
    deleteTag, 
    getTagUsageCount 
  } = useTags();
  
  const { 
    recordings, 
    filters, 
    setFolderFilter, 
    toggleTagFilter,
    getUncategorizedRecordings,
    clearFilters 
  } = useRecordings();
  
  const { loadSettings } = useSearch();

  // Animation values
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  // Local state
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null); // parentId or 'root'
  const [creatingTag, setCreatingTag] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [processingCreate, setProcessingCreate] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });
  const [actionSheet, setActionSheet] = useState<ActionSheetState>({
    visible: false,
    title: '',
    options: [],
  });

  // Initialize stores
  useEffect(() => {
    if (visible) {
      MetaStore.initialize().then(() => {
        loadFolders();
        loadTags();
      });
      // Initialize settings store and load search settings
      SettingsStore.initialize().then(() => {
        loadSettings();
      });
    }
  }, [visible, loadFolders, loadTags, loadSettings]);

  // Animate drawer open/close
  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, { duration: 300 });
      backdropOpacity.value = withTiming(BACKDROP_OPACITY, { duration: 300 });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 300 });
      backdropOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible, translateX, backdropOpacity]);

  // Pan gesture for closing
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newTranslateX = Math.min(0, event.translationX);
      translateX.value = newTranslateX;
      
      const progress = Math.abs(newTranslateX) / DRAWER_WIDTH;
      backdropOpacity.value = BACKDROP_OPACITY * (1 - progress);
    })
    .onEnd((event) => {
      const shouldClose = event.translationX < -DRAWER_WIDTH * 0.3 || event.velocityX < -500;
      
      if (shouldClose) {
        translateX.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
        backdropOpacity.value = withTiming(BACKDROP_OPACITY, { duration: 200 });
      }
    });

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Folder operations
  const handleCreateFolder = useCallback(async (name: string, parentId?: string) => {
    if (processingCreate) return; // Prevent double-clicks
    
    try {
      setProcessingCreate(true);
      await createFolder(name, parentId);
      setCreatingFolder(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      // Keep creating mode active
    } finally {
      setProcessingCreate(false);
    }
  }, [createFolder, processingCreate]);

  const handleFolderPress = useCallback((folderId: string) => {
    setFolderFilter(folderId);
    onClose();
  }, [setFolderFilter, onClose]);

  const handleFolderLongPress = useCallback(async (folderId: string) => {
    const folder = folders.find((f: any) => f.id === folderId);
    if (!folder) return;

    // Calculate usage locally instead of using store method
    const recordingCount = recordings.filter(r => r.folderId === folderId).length;
    const subfolderCount = folders.filter((f: any) => f.parentId === folderId).length;
    
    const options: ActionSheetOption[] = [
      {
        id: 'rename',
        title: 'Rename',
        icon: 'create-outline',
        onPress: () => setEditingFolder(folderId),
      },
    ];

    if (recordingCount === 0 && subfolderCount === 0) {
      options.push({
        id: 'delete',
        title: 'Delete',
        icon: 'trash-outline',
        isDestructive: true,
        onPress: () => handleFolderDelete(folderId),
      });
    }

    setActionSheet({
      visible: true,
      title: `"${folder.name}" Options`,
      options,
    });
  }, [folders, recordings]);

  const handleFolderDelete = useCallback(async (folderId: string) => {
    const result = await deleteFolder(folderId);
    if (!result.canDelete) {
      Alert.alert('Cannot Delete', result.reason);
    }
  }, [deleteFolder]);

  // Tag operations  
  const handleCreateTag = useCallback(async (name: string) => {
    if (processingCreate) return; // Prevent double-clicks
    
    try {
      setProcessingCreate(true);
      await createTag(name);
      setCreatingTag(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      // Keep creating mode active
    } finally {
      setProcessingCreate(false);
    }
  }, [createTag, processingCreate]);

  const handleTagPress = useCallback((tagId: string) => {
    toggleTagFilter(tagId);
  }, [toggleTagFilter]);

  const handleTagLongPress = useCallback(async (tagId: string) => {
    const tag = tags.find((t: any) => t.id === tagId);
    if (!tag) return;

    const options: ActionSheetOption[] = [
      {
        id: 'rename',
        title: 'Rename',
        icon: 'create-outline',
        onPress: () => setEditingTag(tagId),
      },
      {
        id: 'delete',
        title: 'Delete',
        icon: 'trash-outline',
        isDestructive: true,
        onPress: () => handleTagDelete(tagId),
      },
    ];

    setActionSheet({
      visible: true,
      title: `"${tag.name}" Options`,
      options,
    });
  }, [tags]);

  const handleTagDelete = useCallback(async (tagId: string) => {
    const tag = tags.find((t: any) => t.id === tagId);
    if (!tag) return;

    // Calculate usage locally instead of using store method
    const usageCount = recordings.filter(r => r.tags.includes(tagId)).length;
    
    if (usageCount > 0) {
      setConfirmDialog({
        visible: true,
        title: 'Delete Tag?',
        message: `"${tag.name}" is used by ${usageCount} recording${usageCount === 1 ? '' : 's'}. Deleting it will remove it from all recordings. This cannot be undone.`,
        onConfirm: async () => {
          // For now just show the warning - full implementation would batch update recordings
          Alert.alert('Not Implemented', 'Tag deletion with usage is not yet implemented in this demo.');
          setConfirmDialog(prev => ({ ...prev, visible: false }));
        },
        isDestructive: true,
      });
    } else {
      // Safe to delete - no recordings using this tag
      await deleteTag(tagId);
    }
  }, [deleteTag, tags, recordings]);

  // Render functions
  const renderQuickItems = () => {
    const uncategorizedCount = getUncategorizedRecordings().length;
    
    return (
      <>
        <DrawerItem
          icon="musical-notes-outline"
          title="All recordings"
          count={recordings.length}
          isActive={filters.folderId === null && filters.tagIds.length === 0}
          onPress={() => {
            clearFilters();
            onClose();
          }}
        />
        <DrawerItem
          icon="help-circle-outline"
          title="Uncategorized"
          count={uncategorizedCount}
          isActive={false}
          onPress={() => {
            // Filter for uncategorized would require special handling
            onClose();
          }}
        />
      </>
    );
  };

  const renderFolders = () => {
    const rootFolders = getFoldersByParent(null);
    
    return (
      <>
        {rootFolders.map((folder: any) => {
          const recordingCount = recordings.filter(r => r.folderId === folder.id).length;
          const subfolders = getFoldersByParent(folder.id);
          
          return (
            <View key={folder.id}>
              {editingFolder === folder.id ? (
                <TextField
                  value={folder.name}
                  placeholder="Folder name"
                  onSubmit={(name) => {
                    updateFolder(folder.id, { name });
                    setEditingFolder(null);
                  }}
                  onCancel={() => setEditingFolder(null)}
                />
              ) : (
                <DrawerItem
                  icon="folder-outline"
                  title={folder.name}
                  count={recordingCount}
                  isActive={filters.folderId === folder.id}
                  onPress={() => handleFolderPress(folder.id)}
                  onLongPress={() => handleFolderLongPress(folder.id)}
                  showMenu
                  onMenuPress={() => handleFolderLongPress(folder.id)}
                />
              )}
              
              {/* Render subfolders */}
              {subfolders.map((subfolder: any) => {
                const subRecordingCount = recordings.filter(r => r.folderId === subfolder.id).length;
                
                return editingFolder === subfolder.id ? (
                  <TextField
                    key={subfolder.id}
                    value={subfolder.name}
                    placeholder="Folder name"
                    onSubmit={(name) => {
                      updateFolder(subfolder.id, { name });
                      setEditingFolder(null);
                    }}
                    onCancel={() => setEditingFolder(null)}
                  />
                ) : (
                  <DrawerItem
                    key={subfolder.id}
                    icon="folder-open-outline"
                    title={subfolder.name}
                    count={subRecordingCount}
                    isActive={filters.folderId === subfolder.id}
                    onPress={() => handleFolderPress(subfolder.id)}
                    onLongPress={() => handleFolderLongPress(subfolder.id)}
                    showMenu
                    onMenuPress={() => handleFolderLongPress(subfolder.id)}
                    style={{ marginLeft: theme.spacing.lg }}
                  />
                );
              })}
              
              {/* Create subfolder option */}
              {creatingFolder === folder.id && (
                <TextField
                  value=""
                  placeholder="Subfolder name"
                  onSubmit={(name) => handleCreateFolder(name, folder.id)}
                  onCancel={() => setCreatingFolder(null)}
                  style={{ marginLeft: theme.spacing.lg }}
                />
              )}
              
              <DrawerItem
                icon="add-outline"
                title="Create subfolder"
                onPress={() => setCreatingFolder(folder.id)}
                style={{ marginLeft: theme.spacing.lg, opacity: 0.7 }}
              />
            </View>
          );
        })}
        
        {/* Create root folder */}
        {creatingFolder === 'root' && (
          <TextField
            value=""
            placeholder="Folder name"
            onSubmit={(name) => handleCreateFolder(name)}
            onCancel={() => setCreatingFolder(null)}
          />
        )}
        
        <DrawerItem
          icon="add-outline"
          title="Create folder"
          onPress={() => setCreatingFolder('root')}
          style={{ opacity: 0.7 }}
        />
      </>
    );
  };

  const renderTags = () => {
    return (
      <>
        {tags.map((tag: any) => {
          const recordingCount = recordings.filter(r => r.tags.includes(tag.id)).length;
          
          return editingTag === tag.id ? (
            <TextField
              key={tag.id}
              value={tag.name}
              placeholder="Tag name"
              onSubmit={(name) => {
                updateTag(tag.id, { name });
                setEditingTag(null);
              }}
              onCancel={() => setEditingTag(null)}
            />
          ) : (
            <DrawerItem
              key={tag.id}
              icon="pricetag-outline"
              title={tag.name}
              count={recordingCount}
              isActive={filters.tagIds.includes(tag.id)}
              onPress={() => handleTagPress(tag.id)}
              onLongPress={() => handleTagLongPress(tag.id)}
              showMenu
              onMenuPress={() => handleTagLongPress(tag.id)}
            />
          );
        })}
        
        {/* Create tag */}
        {creatingTag && (
          <TextField
            value=""
            placeholder="Tag name"
            onSubmit={handleCreateTag}
            onCancel={() => setCreatingTag(false)}
          />
        )}
        
        <DrawerItem
          icon="add-outline"
          title="Create tag"
          onPress={() => setCreatingTag(true)}
          style={{ opacity: 0.7 }}
        />
      </>
    );
  };

  if (!visible) return null;

  const styles = StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1000,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'black',
    },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: theme.colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 16,
    },
    content: {
      flex: 1,
      paddingTop: insets.top,
    },
    searchContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    scrollContent: {
      flex: 1,
    },
  });

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <GestureDetector gesture={Gesture.Tap().onStart(() => runOnJS(onClose)())}>
          <View style={{ flex: 1 }} />
        </GestureDetector>
      </Animated.View>

      {/* Drawer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.drawer, drawerStyle]}>
          <View style={styles.content}>
            <DrawerHandle onClose={onClose} />
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <SearchBar autoFocus={visible} />
            </View>

            <Animated.ScrollView 
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              accessibilityLiveRegion="polite"
              accessibilityLabel="Filters opened"
            >
              {/* Quick items */}
              <DrawerSection title="Quick Access">
                {renderQuickItems()}
              </DrawerSection>

              {/* Folders */}
              <DrawerSection title="Folders">
                {renderFolders()}
              </DrawerSection>

              {/* Tags */}
              <DrawerSection title="Tags">
                {renderTags()}
              </DrawerSection>
              
              {/* Sort Controls */}
              <SortControls />
            </Animated.ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />

      {/* Action Sheet */}
      <ActionSheet
        visible={actionSheet.visible}
        title={actionSheet.title}
        options={actionSheet.options}
        onCancel={() => setActionSheet({ visible: false, title: '', options: [] })}
      />
    </View>
  );
}