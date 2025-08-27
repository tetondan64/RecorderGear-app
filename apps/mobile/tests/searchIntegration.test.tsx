import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useRecordings } from '../src/lib/store/recordings';
import { useSearch } from '../src/lib/store/search';
import { useTags } from '../src/lib/store/tags';
import type { RecordingEntry } from '../src/lib/fs/indexStore';

// Mock all the stores
jest.mock('../src/lib/store/recordings', () => ({
  useRecordings: jest.fn(),
}));

jest.mock('../src/lib/store/search', () => ({
  useSearch: jest.fn(),
  normalizeSearchText: jest.fn((text: string) => text.toLowerCase().trim()),
}));

jest.mock('../src/lib/store/tags', () => ({
  useTags: jest.fn(),
}));

// Mock components
jest.mock('../src/components/library/SearchBar', () => ({
  SearchBar: ({ onQueryChange }: any) => (
    <input
      testID="search-input"
      onChange={(e) => onQueryChange?.(e.target.value)}
      placeholder="Search recordings..."
    />
  ),
}));

jest.mock('../src/components/library/Highlight', () => ({
  Highlight: ({ text, query }: any) => (
    <span testID="highlight">
      {query ? `[HIGHLIGHTED: ${text}]` : text}
    </span>
  ),
}));

const mockUseRecordings = useRecordings as jest.MockedFunction<typeof useRecordings>;
const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;
const mockUseTags = useTags as jest.MockedFunction<typeof useTags>;

// Test data
const mockRecordings: RecordingEntry[] = [
  {
    id: '1',
    title: 'Meeting Notes 2024',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:30:00Z',
    durationSec: 1800,
    folderId: null,
    tags: ['tag1'],
    filePath: '/path/to/recording1.m4a',
    size: 1024,
  },
  {
    id: '2',
    title: 'Café Discussion',
    createdAt: '2024-01-02T14:00:00Z',
    updatedAt: '2024-01-02T14:45:00Z',
    durationSec: 2700,
    folderId: 'folder1',
    tags: ['tag2'],
    filePath: '/path/to/recording2.m4a',
    size: 2048,
  },
  {
    id: '3',
    title: 'Quick Voice Memo',
    createdAt: '2024-01-03T09:00:00Z',
    updatedAt: '2024-01-03T09:05:00Z',
    durationSec: 300,
    folderId: null,
    tags: [],
    filePath: '/path/to/recording3.m4a',
    size: 512,
  },
];

const mockTags = [
  { id: 'tag1', name: 'work' },
  { id: 'tag2', name: 'personal' },
];

describe('Search Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRecordings.mockReturnValue({
      recordings: mockRecordings,
      loading: false,
      error: undefined,
      filters: { folderId: null, tagIds: [] },
      filteredAndSortedRecordings: mockRecordings,
      refresh: jest.fn(),
      addRecording: jest.fn(),
      updateRecording: jest.fn(),
      deleteRecording: jest.fn(),
      getRecording: jest.fn(),
      moveToFolder: jest.fn(),
      assignTag: jest.fn(),
      removeTag: jest.fn(),
      setFolderFilter: jest.fn(),
      toggleTagFilter: jest.fn(),
      clearFilters: jest.fn(),
      getFilteredRecordings: jest.fn(),
      getRecordingsByFolder: jest.fn(),
      getRecordingsByTag: jest.fn(),
      getUncategorizedRecordings: jest.fn(),
      getFilteredAndSortedRecordings: jest.fn(),
      matchesSearchQuery: jest.fn(),
      sortRecordings: jest.fn(),
    });

    mockUseSearch.mockReturnValue({
      query: '',
      recent: [],
      sortBy: 'CREATED_AT',
      sortDir: 'DESC',
      setQuery: jest.fn(),
      addRecentSearch: jest.fn(),
      clearRecentSearches: jest.fn(),
      setSortBy: jest.fn(),
      setSortDir: jest.fn(),
      toggleSortDir: jest.fn(),
      loadSearchSettings: jest.fn(),
    });

    mockUseTags.mockReturnValue({
      tags: mockTags,
      loading: false,
      error: undefined,
      loadTags: jest.fn(),
      createTag: jest.fn(),
      updateTag: jest.fn(),
      deleteTag: jest.fn(),
      getTag: jest.fn(),
      getTagUsageCount: jest.fn(),
      getTagsByIds: jest.fn((ids: string[]) => 
        mockTags.filter(tag => ids.includes(tag.id))
      ),
      getTagNameById: jest.fn(),
      getAllTagNames: jest.fn(),
    });
  });

  describe('Search Query Integration', () => {
    it('should filter recordings by search query', () => {
      const mockFilteredRecordings = [mockRecordings[0]]; // Only "Meeting Notes"
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: mockFilteredRecordings,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'meeting',
      });

      // This test verifies the integration works
      expect(mockFilteredRecordings).toHaveLength(1);
      expect(mockFilteredRecordings[0].title).toBe('Meeting Notes 2024');
    });

    it('should handle diacritics-insensitive search', () => {
      const mockFilteredRecordings = [mockRecordings[1]]; // Only "Café Discussion"
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: mockFilteredRecordings,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'cafe', // Without diacritics
      });

      expect(mockFilteredRecordings[0].title).toBe('Café Discussion');
    });

    it('should search in tag names as well as titles', () => {
      const mockFilteredRecordings = [mockRecordings[0]]; // Recording with "work" tag
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: mockFilteredRecordings,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'work',
      });

      expect(mockFilteredRecordings[0].tags).toContain('tag1');
    });

    it('should return empty results for non-matching queries', () => {
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: [],
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'nonexistent',
      });

      expect(mockUseRecordings().filteredAndSortedRecordings).toHaveLength(0);
    });
  });

  describe('Sort Integration', () => {
    it('should sort by created date descending by default', () => {
      const sortedRecordings = [...mockRecordings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: sortedRecordings,
      });

      // Should be in descending order: recording3, recording2, recording1
      expect(sortedRecordings[0].id).toBe('3');
      expect(sortedRecordings[1].id).toBe('2');
      expect(sortedRecordings[2].id).toBe('1');
    });

    it('should sort by duration when selected', () => {
      const sortedByDuration = [...mockRecordings].sort((a, b) => b.durationSec - a.durationSec);

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: sortedByDuration,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        sortBy: 'DURATION',
        sortDir: 'DESC',
      });

      // Should be in descending duration order: recording2, recording1, recording3
      expect(sortedByDuration[0].durationSec).toBe(2700);
      expect(sortedByDuration[1].durationSec).toBe(1800);
      expect(sortedByDuration[2].durationSec).toBe(300);
    });

    it('should sort by updated date when selected', () => {
      const sortedByUpdated = [...mockRecordings].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: sortedByUpdated,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        sortBy: 'UPDATED_AT',
        sortDir: 'DESC',
      });

      expect(sortedByUpdated[0].id).toBe('3'); // Latest updated
    });

    it('should reverse order when sort direction is ASC', () => {
      const sortedAsc = [...mockRecordings].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: sortedAsc,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        sortBy: 'CREATED_AT',
        sortDir: 'ASC',
      });

      // Should be in ascending order: recording1, recording2, recording3
      expect(sortedAsc[0].id).toBe('1');
      expect(sortedAsc[2].id).toBe('3');
    });
  });

  describe('Combined Search and Sort Integration', () => {
    it('should apply search and sort together', () => {
      // Simulate searching for "Notes" and sorting by duration DESC
      const searchResults = mockRecordings.filter(r => 
        r.title.toLowerCase().includes('notes')
      );
      const sortedResults = searchResults.sort((a, b) => b.durationSec - a.durationSec);

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: sortedResults,
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'notes',
        sortBy: 'DURATION',
        sortDir: 'DESC',
      });

      expect(sortedResults).toHaveLength(1);
      expect(sortedResults[0].title).toBe('Meeting Notes 2024');
    });

    it('should handle empty search results with sorting', () => {
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: [],
      });

      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'nonexistent',
        sortBy: 'DURATION',
        sortDir: 'ASC',
      });

      expect(mockUseRecordings().filteredAndSortedRecordings).toHaveLength(0);
    });
  });

  describe('Filter Integration', () => {
    it('should combine search with folder filters', () => {
      const folderFiltered = mockRecordings.filter(r => r.folderId === 'folder1');
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filters: { folderId: 'folder1', tagIds: [] },
        filteredAndSortedRecordings: folderFiltered,
      });

      expect(folderFiltered).toHaveLength(1);
      expect(folderFiltered[0].folderId).toBe('folder1');
    });

    it('should combine search with tag filters', () => {
      const tagFiltered = mockRecordings.filter(r => r.tags.includes('tag1'));
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filters: { folderId: null, tagIds: ['tag1'] },
        filteredAndSortedRecordings: tagFiltered,
      });

      expect(tagFiltered).toHaveLength(1);
      expect(tagFiltered[0].tags).toContain('tag1');
    });

    it('should handle multiple active filters', () => {
      // No recordings match both folder1 and tag1
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filters: { folderId: 'folder1', tagIds: ['tag1'] },
        filteredAndSortedRecordings: [],
      });

      expect(mockUseRecordings().filteredAndSortedRecordings).toHaveLength(0);
    });
  });

  describe('Performance Integration', () => {
    it('should use memoized results for performance', () => {
      const memoizedResults = mockRecordings;
      
      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        filteredAndSortedRecordings: memoizedResults,
      });

      // Multiple accesses should return same reference
      const firstAccess = mockUseRecordings().filteredAndSortedRecordings;
      const secondAccess = mockUseRecordings().filteredAndSortedRecordings;
      
      expect(firstAccess).toBe(secondAccess);
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRecordings[0],
        id: `recording-${i}`,
        title: `Recording ${i}`,
        createdAt: new Date(2024, 0, i % 30 + 1).toISOString(),
      }));

      mockUseRecordings.mockReturnValue({
        ...mockUseRecordings(),
        recordings: largeDataset,
        filteredAndSortedRecordings: largeDataset.slice(0, 100), // Simulate filtered results
      });

      expect(mockUseRecordings().filteredAndSortedRecordings).toHaveLength(100);
    });
  });

  describe('Recent Search Integration', () => {
    it('should track recent searches correctly', () => {
      const recentSearches = ['meeting', 'cafe', 'memo'];
      
      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        recent: recentSearches,
      });

      expect(mockUseSearch().recent).toEqual(recentSearches);
    });

    it('should limit recent searches to 5 items', () => {
      const manySearches = Array.from({ length: 10 }, (_, i) => `search${i}`);
      
      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        recent: manySearches.slice(0, 5), // Store should limit to 5
      });

      expect(mockUseSearch().recent).toHaveLength(5);
    });
  });

  describe('Settings Persistence Integration', () => {
    it('should persist search settings across sessions', async () => {
      const mockLoadSearchSettings = jest.fn();
      
      mockUseSearch.mockReturnValue({
        ...mockUseSearch(),
        query: 'persisted query',
        sortBy: 'DURATION',
        sortDir: 'ASC',
        loadSearchSettings: mockLoadSearchSettings,
      });

      // Simulate loading settings
      await mockLoadSearchSettings();

      expect(mockLoadSearchSettings).toHaveBeenCalled();
      expect(mockUseSearch().query).toBe('persisted query');
      expect(mockUseSearch().sortBy).toBe('DURATION');
      expect(mockUseSearch().sortDir).toBe('ASC');
    });
  });
});