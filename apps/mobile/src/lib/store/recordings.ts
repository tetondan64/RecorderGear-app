import { useState, useEffect, useCallback, useMemo } from 'react';
import { IndexStore, RecordingEntry } from '../fs/indexStore';
import { useSearch, normalizeSearchText } from './search';
import { useTags } from './tags';
import { SortBy, SortDir } from '../fs/settingsStore';

export interface FilterState {
  folderId: string | null;
  tagIds: string[];
}

export interface RecordingsState {
  recordings: RecordingEntry[];
  loading: boolean;
  error?: string;
  filters: FilterState;
}

export function useRecordings() {
  const [state, setState] = useState<RecordingsState>({
    recordings: [],
    loading: true,
    filters: {
      folderId: null,
      tagIds: [],
    },
  });
  
  // Access search store for query and sort preferences
  const { query, sortBy, sortDir } = useSearch();
  const { getTagsByIds } = useTags();

  const loadRecordings = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      const recordings = await IndexStore.getAllRecordings();
      setState(prev => ({
        ...prev,
        recordings,
        loading: false,
      }));
    } catch (error) {
      console.error('Failed to load recordings:', error);
      setState(prev => ({
        ...prev,
        recordings: [],
        loading: false,
        error: 'Failed to load recordings',
      }));
    }
  }, []);

  const addRecording = useCallback(async (entry: RecordingEntry) => {
    try {
      await IndexStore.addRecording(entry);
      setState(prev => ({
        ...prev,
        recordings: [entry, ...prev.recordings],
      }));

      // Trigger auto-sync for newly added recording
      try {
        const { onRecordingSavedTrigger } = await import('../sync/integration');
        await onRecordingSavedTrigger(entry);
        console.log('RECORDINGS: Auto-sync triggered for recording:', entry.id);
      } catch (syncError) {
        console.warn('RECORDINGS: Auto-sync trigger failed (non-blocking):', syncError);
        // Don't throw - sync failure shouldn't break recording add
      }
    } catch (error) {
      console.error('Failed to add recording:', error);
      throw new Error('Failed to save recording');
    }
  }, []);

  const updateRecording = useCallback(async (id: string, updates: Partial<RecordingEntry>) => {
    try {
      await IndexStore.updateRecording(id, updates);
      setState(prev => ({
        ...prev,
        recordings: prev.recordings.map(r => 
          r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
        ),
      }));
    } catch (error) {
      console.error('Failed to update recording:', error);
      throw new Error('Failed to update recording');
    }
  }, []);

  const deleteRecording = useCallback(async (id: string) => {
    try {
      await IndexStore.deleteRecording(id);
      setState(prev => ({
        ...prev,
        recordings: prev.recordings.filter(r => r.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw new Error('Failed to delete recording');
    }
  }, []);

  const getRecording = useCallback((id: string): RecordingEntry | undefined => {
    return state.recordings.find(r => r.id === id);
  }, [state.recordings]);

  // Folder operations
  const moveToFolder = useCallback(async (recordingId: string, folderId: string | null) => {
    try {
      await updateRecording(recordingId, { folderId });
      console.log('RECORDINGS: Moved recording to folder:', { recordingId, folderId });
    } catch (error) {
      console.error('Failed to move recording to folder:', error);
      throw error;
    }
  }, [updateRecording]);

  // Tag operations
  const assignTag = useCallback(async (recordingId: string, tagId: string) => {
    const recording = getRecording(recordingId);
    if (!recording) {
      throw new Error('Recording not found');
    }

    if (recording.tags.includes(tagId)) {
      return; // Tag already assigned
    }

    const updatedTags = [...recording.tags, tagId];
    try {
      await updateRecording(recordingId, { tags: updatedTags });
      console.log('RECORDINGS: Assigned tag:', { recordingId, tagId });
    } catch (error) {
      console.error('Failed to assign tag:', error);
      throw error;
    }
  }, [getRecording, updateRecording]);

  const removeTag = useCallback(async (recordingId: string, tagId: string) => {
    const recording = getRecording(recordingId);
    if (!recording) {
      throw new Error('Recording not found');
    }

    const updatedTags = recording.tags.filter(id => id !== tagId);
    try {
      await updateRecording(recordingId, { tags: updatedTags });
      console.log('RECORDINGS: Removed tag:', { recordingId, tagId });
    } catch (error) {
      console.error('Failed to remove tag:', error);
      throw error;
    }
  }, [getRecording, updateRecording]);

  // Filter operations
  const setFolderFilter = useCallback((folderId: string | null) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, folderId }
    }));
    console.log('RECORDINGS: Set folder filter:', folderId);
  }, []);

  const toggleTagFilter = useCallback((tagId: string) => {
    setState(prev => {
      const isActive = prev.filters.tagIds.includes(tagId);
      const updatedTagIds = isActive 
        ? prev.filters.tagIds.filter(id => id !== tagId)
        : [...prev.filters.tagIds, tagId];
      
      console.log('RECORDINGS: Toggle tag filter:', { tagId, isActive, updatedTagIds });
      
      return {
        ...prev,
        filters: { ...prev.filters, tagIds: updatedTagIds }
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: { folderId: null, tagIds: [] }
    }));
    console.log('RECORDINGS: Cleared all filters');
  }, []);

  // Filtered recordings getter
  const getFilteredRecordings = useCallback(() => {
    const { folderId, tagIds } = state.filters;
    let filtered = [...state.recordings];

    // Apply folder filter
    if (folderId !== null) {
      filtered = filtered.filter(r => r.folderId === folderId);
    }

    // Apply tag filters (AND logic - recording must have all selected tags)
    if (tagIds.length > 0) {
      filtered = filtered.filter(r => 
        tagIds.every(tagId => r.tags.includes(tagId))
      );
    }

    return filtered;
  }, [state.recordings, state.filters]);

  // Selectors for specific filters
  const getRecordingsByFolder = useCallback((folderId: string | null) => {
    return state.recordings.filter(r => r.folderId === folderId);
  }, [state.recordings]);

  const getRecordingsByTag = useCallback((tagId: string) => {
    return state.recordings.filter(r => r.tags.includes(tagId));
  }, [state.recordings]);

  const getUncategorizedRecordings = useCallback(() => {
    return state.recordings.filter(r => r.folderId === null && r.tags.length === 0);
  }, [state.recordings]);
  
  // Search functionality
  const matchesSearchQuery = useCallback((recording: RecordingEntry, searchQuery: string): boolean => {
    if (!searchQuery.trim()) return true;
    
    const normalizedQuery = normalizeSearchText(searchQuery);
    
    // Search in title
    if (normalizeSearchText(recording.title).includes(normalizedQuery)) {
      return true;
    }
    
    // Search in tag names
    const tags = getTagsByIds(recording.tags);
    return tags.some(tag => 
      normalizeSearchText(tag.name).includes(normalizedQuery)
    );
  }, [getTagsByIds]);
  
  // Sort functionality
  const sortRecordings = useCallback((recordings: RecordingEntry[], sortBy: SortBy, sortDir: SortDir): RecordingEntry[] => {
    const sorted = [...recordings].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'CREATED_AT':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'UPDATED_AT':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'DURATION':
          comparison = a.durationSec - b.durationSec;
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      if (comparison === 0) {
        // Stable tiebreaker: CREATED_AT desc, then title asc
        const createdComparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (createdComparison === 0) {
          return a.title.localeCompare(b.title);
        }
        return createdComparison;
      }
      
      return sortDir === 'ASC' ? comparison : -comparison;
    });
    
    return sorted;
  }, []);
  
  // Combined filtered and sorted recordings selector
  const getFilteredAndSortedRecordings = useCallback(() => {
    const { folderId, tagIds } = state.filters;
    let filtered = [...state.recordings];

    // Apply folder filter
    if (folderId !== null) {
      filtered = filtered.filter(r => r.folderId === folderId);
    }

    // Apply tag filters (AND logic - recording must have all selected tags)
    if (tagIds.length > 0) {
      filtered = filtered.filter(r => 
        tagIds.every(tagId => r.tags.includes(tagId))
      );
    }
    
    // Apply search query
    if (query.trim()) {
      filtered = filtered.filter(r => matchesSearchQuery(r, query));
    }
    
    // Apply sorting
    return sortRecordings(filtered, sortBy, sortDir);
  }, [state.recordings, state.filters, query, sortBy, sortDir, matchesSearchQuery, sortRecordings]);
  
  // Memoized selector for performance
  const filteredAndSortedRecordings = useMemo(() => 
    getFilteredAndSortedRecordings(), 
    [getFilteredAndSortedRecordings]
  );

  // Load recordings on mount
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  return {
    ...state,
    refresh: loadRecordings,
    addRecording,
    updateRecording,
    deleteRecording,
    getRecording,
    // Folder operations
    moveToFolder,
    // Tag operations  
    assignTag,
    removeTag,
    // Filter operations
    setFolderFilter,
    toggleTagFilter,
    clearFilters,
    // Selectors
    getFilteredRecordings,
    getRecordingsByFolder,
    getRecordingsByTag,
    getUncategorizedRecordings,
    // Search & Sort selectors
    getFilteredAndSortedRecordings,
    filteredAndSortedRecordings,
    matchesSearchQuery,
    sortRecordings,
  };
}