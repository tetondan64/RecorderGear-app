import { renderHook, act } from '@testing-library/react-native';
import { useSearch, normalizeSearchText } from '../src/lib/store/search';
import { SettingsStore } from '../src/lib/fs/settingsStore';

// Mock SettingsStore
jest.mock('../src/lib/fs/settingsStore', () => ({
  SettingsStore: {
    readSearchSettings: jest.fn(),
    writeSearchSettings: jest.fn(),
  },
}));

const mockSettingsStore = SettingsStore as jest.Mocked<typeof SettingsStore>;

describe('Search Store', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementation
    mockSettingsStore.readSearchSettings.mockResolvedValue({
      query: '',
      recent: [],
      sortBy: 'CREATED_AT',
      sortDir: 'DESC',
    });
    mockSettingsStore.writeSearchSettings.mockResolvedValue();
  });

  describe('normalizeSearchText', () => {
    it('should normalize text to lowercase', () => {
      expect(normalizeSearchText('Hello World')).toBe('hello world');
    });

    it('should remove diacritics and accents', () => {
      expect(normalizeSearchText('café')).toBe('cafe');
      expect(normalizeSearchText('naïve')).toBe('naive');
      expect(normalizeSearchText('résumé')).toBe('resume');
    });

    it('should handle mixed case with diacritics', () => {
      expect(normalizeSearchText('Björk')).toBe('bjork');
      expect(normalizeSearchText('François')).toBe('francois');
    });

    it('should trim whitespace', () => {
      expect(normalizeSearchText('  test  ')).toBe('test');
    });

    it('should handle empty strings', () => {
      expect(normalizeSearchText('')).toBe('');
      expect(normalizeSearchText('   ')).toBe('');
    });
  });

  describe('useSearch hook', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useSearch());
      
      expect(result.current.query).toBe('');
      expect(result.current.recent).toEqual([]);
      expect(result.current.sortBy).toBe('CREATED_AT');
      expect(result.current.sortDir).toBe('DESC');
    });

    it('should load settings from SettingsStore', async () => {
      mockSettingsStore.readSearchSettings.mockResolvedValue({
        query: 'test query',
        recent: ['search1', 'search2'],
        sortBy: 'DURATION',
        sortDir: 'ASC',
      });

      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        await result.current.loadSearchSettings();
      });

      expect(result.current.query).toBe('test query');
      expect(result.current.recent).toEqual(['search1', 'search2']);
      expect(result.current.sortBy).toBe('DURATION');
      expect(result.current.sortDir).toBe('ASC');
    });

    it('should persist query changes to SettingsStore', async () => {
      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        result.current.setQuery('new query');
      });

      expect(result.current.query).toBe('new query');
      expect(mockSettingsStore.writeSearchSettings).toHaveBeenCalledWith({
        query: 'new query',
        recent: [],
        sortBy: 'CREATED_AT',
        sortDir: 'DESC',
      });
    });

    it('should add to recent searches with max 5 limit', async () => {
      const { result } = renderHook(() => useSearch());
      
      // Add 6 searches to test the limit
      await act(async () => {
        result.current.addRecentSearch('search1');
        result.current.addRecentSearch('search2');
        result.current.addRecentSearch('search3');
        result.current.addRecentSearch('search4');
        result.current.addRecentSearch('search5');
        result.current.addRecentSearch('search6');
      });

      // Should only keep the 5 most recent
      expect(result.current.recent).toEqual([
        'search6', 'search5', 'search4', 'search3', 'search2'
      ]);
    });

    it('should not add duplicate recent searches', async () => {
      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        result.current.addRecentSearch('duplicate');
        result.current.addRecentSearch('other');
        result.current.addRecentSearch('duplicate');
      });

      expect(result.current.recent).toEqual(['duplicate', 'other']);
    });

    it('should not add empty queries to recent', async () => {
      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        result.current.addRecentSearch('');
        result.current.addRecentSearch('   ');
        result.current.addRecentSearch('valid');
      });

      expect(result.current.recent).toEqual(['valid']);
    });

    it('should clear recent searches', async () => {
      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        result.current.addRecentSearch('search1');
        result.current.addRecentSearch('search2');
        result.current.clearRecentSearches();
      });

      expect(result.current.recent).toEqual([]);
    });

    it('should update sort preferences', async () => {
      const { result } = renderHook(() => useSearch());
      
      await act(async () => {
        result.current.setSortBy('UPDATED_AT');
        result.current.setSortDir('ASC');
      });

      expect(result.current.sortBy).toBe('UPDATED_AT');
      expect(result.current.sortDir).toBe('ASC');
    });

    it('should toggle sort direction', async () => {
      const { result } = renderHook(() => useSearch());
      
      expect(result.current.sortDir).toBe('DESC');
      
      await act(async () => {
        result.current.toggleSortDir();
      });

      expect(result.current.sortDir).toBe('ASC');
      
      await act(async () => {
        result.current.toggleSortDir();
      });

      expect(result.current.sortDir).toBe('DESC');
    });
  });
});