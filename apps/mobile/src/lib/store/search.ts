import { create } from 'zustand';
import { SettingsStore, SearchSettings, SortBy, SortDir } from '../fs/settingsStore';

/**
 * Search store manages search query, recent searches, and sort preferences
 * Integrates with SettingsStore for persistence
 */

interface SearchState {
  // Current search state
  query: string;
  recent: string[];
  sortBy: SortBy;
  sortDir: SortDir;
  
  // Loading states
  loading: boolean;
  error?: string;
}

interface SearchActions {
  // Search actions
  setQuery: (query: string) => void;
  clearQuery: () => void;
  addRecentSearch: (query: string) => void;
  applyRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  
  // Sort actions  
  setSortBy: (sortBy: SortBy) => void;
  setSortDir: (sortDir: SortDir) => void;
  toggleSortDir: () => void;
  
  // Store management
  loadSettings: () => Promise<void>;
  reset: () => void;
}

type SearchStore = SearchState & SearchActions;

/**
 * Normalize text for search: lowercase, strip diacritics, trim
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD') // Decompose characters with diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .trim();
}

/**
 * Add a search query to recent searches list
 * - Max 5 items
 * - Newest first
 * - No duplicates (case-insensitive)
 * - Skip empty queries
 */
function addToRecent(recent: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return recent;
  
  // Remove existing occurrence (case-insensitive)
  const filtered = recent.filter(
    item => normalizeSearchText(item) !== normalizeSearchText(trimmed)
  );
  
  // Add to front and limit to 5
  return [trimmed, ...filtered].slice(0, 5);
}

/**
 * Persist current state to settings
 */
async function persistState(state: SearchState): Promise<void> {
  try {
    const settings: SearchSettings = {
      query: state.query,
      recent: state.recent,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    };
    
    await SettingsStore.writeSettings(settings);
  } catch (error) {
    console.error('SEARCH_STORE: Failed to persist state:', error);
  }
}

export const useSearch = create<SearchStore>((set, get) => ({
  // Initial state
  query: '',
  recent: [],
  sortBy: 'CREATED_AT',
  sortDir: 'DESC',
  loading: false,
  
  // Search actions
  setQuery: (query: string) => {
    set({ query });
    const state = get();
    persistState(state);
  },
  
  clearQuery: () => {
    set({ query: '' });
    const state = get();
    persistState(state);
  },
  
  addRecentSearch: (query: string) => {
    const { recent } = get();
    const newRecent = addToRecent(recent, query);
    
    set({ recent: newRecent });
    const state = get();
    persistState(state);
  },
  
  applyRecentSearch: (query: string) => {
    set({ query });
    const state = get();
    persistState(state);
  },
  
  clearRecentSearches: () => {
    set({ recent: [] });
    const state = get();
    persistState(state);
  },
  
  // Sort actions
  setSortBy: (sortBy: SortBy) => {
    set({ sortBy });
    const state = get();
    persistState(state);
  },
  
  setSortDir: (sortDir: SortDir) => {
    set({ sortDir });
    const state = get();
    persistState(state);
  },
  
  toggleSortDir: () => {
    const { sortDir } = get();
    const newSortDir: SortDir = sortDir === 'ASC' ? 'DESC' : 'ASC';
    set({ sortDir: newSortDir });
    const state = get();
    persistState(state);
  },
  
  // Store management
  loadSettings: async () => {
    try {
      set({ loading: true, error: undefined });
      
      const settings = await SettingsStore.readSettings();
      
      set({
        query: settings.query || '',
        recent: settings.recent || [],
        sortBy: settings.sortBy || 'CREATED_AT',
        sortDir: settings.sortDir || 'DESC',
        loading: false,
      });
      
      console.log('SEARCH_STORE: Settings loaded successfully');
    } catch (error) {
      console.error('SEARCH_STORE: Failed to load settings:', error);
      set({
        loading: false,
        error: 'Failed to load search settings',
      });
    }
  },
  
  reset: () => {
    const defaults = SettingsStore.getDefaultSettings();
    set({
      query: defaults.query,
      recent: defaults.recent,
      sortBy: defaults.sortBy,
      sortDir: defaults.sortDir,
      loading: false,
      error: undefined,
    });
    const state = get();
    persistState(state);
  },
}));