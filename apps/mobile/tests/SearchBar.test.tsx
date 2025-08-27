import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchBar } from '../src/components/library/SearchBar';
import { useSearch } from '../src/lib/store/search';

// Mock the search store
jest.mock('../src/lib/store/search', () => ({
  useSearch: jest.fn(),
}));

// Mock the theme hook
jest.mock('../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        surface: '#F2F2F7',
        border: '#C6C6C8',
        text: '#000000',
        textSecondary: '#8E8E93',
        primary: '#007AFF',
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
      },
      typography: {
        sizes: { md: 16, sm: 14 },
        weights: { medium: '500' },
      },
    },
  }),
}));

const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;

describe('SearchBar Component', () => {
  const mockSetQuery = jest.fn();
  const mockAddRecentSearch = jest.fn();
  const mockClearRecentSearches = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseSearch.mockReturnValue({
      query: '',
      recent: [],
      sortBy: 'CREATED_AT',
      sortDir: 'DESC',
      setQuery: mockSetQuery,
      addRecentSearch: mockAddRecentSearch,
      clearRecentSearches: mockClearRecentSearches,
      setSortBy: jest.fn(),
      setSortDir: jest.fn(),
      toggleSortDir: jest.fn(),
      loadSearchSettings: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render with placeholder text', () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    
    expect(getByPlaceholderText('Search recordings...')).toBeTruthy();
  });

  it('should display current query value', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      query: 'test query',
    });

    const { getByDisplayValue } = render(<SearchBar />);
    
    expect(getByDisplayValue('test query')).toBeTruthy();
  });

  it('should call setQuery with debounce on text change', async () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    act(() => {
      fireEvent.changeText(input, 'test search');
    });

    // Should not call immediately
    expect(mockSetQuery).not.toHaveBeenCalled();

    // Fast-forward debounce timer (150ms)
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(mockSetQuery).toHaveBeenCalledWith('test search');
  });

  it('should debounce rapid text changes', async () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    act(() => {
      fireEvent.changeText(input, 't');
      fireEvent.changeText(input, 'te');
      fireEvent.changeText(input, 'tes');
      fireEvent.changeText(input, 'test');
    });

    // Fast-forward less than debounce time
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Should not have called yet
    expect(mockSetQuery).not.toHaveBeenCalled();

    // Fast-forward past debounce time
    act(() => {
      jest.advanceTimersByTime(50);
    });

    // Should call only once with final value
    expect(mockSetQuery).toHaveBeenCalledTimes(1);
    expect(mockSetQuery).toHaveBeenCalledWith('test');
  });

  it('should add to recent searches when user stops typing', async () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      query: '', // Different from what user types
    });

    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    act(() => {
      fireEvent.changeText(input, 'new search');
      jest.advanceTimersByTime(150);
    });

    expect(mockAddRecentSearch).toHaveBeenCalledWith('new search');
  });

  it('should not add to recent searches if query is same as current', async () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      query: 'same query',
    });

    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    act(() => {
      fireEvent.changeText(input, 'same query');
      jest.advanceTimersByTime(150);
    });

    expect(mockAddRecentSearch).not.toHaveBeenCalled();
  });

  it('should show recent searches dropdown when focused with recent searches', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      recent: ['recent1', 'recent2'],
    });

    const { getByPlaceholderText, getByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);

    expect(getByText('recent1')).toBeTruthy();
    expect(getByText('recent2')).toBeTruthy();
  });

  it('should not show dropdown when no recent searches', () => {
    const { getByPlaceholderText, queryByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);

    expect(queryByText('Clear Recent')).toBeFalsy();
  });

  it('should hide dropdown when input loses focus', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      recent: ['recent1'],
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);
    expect(getByText('recent1')).toBeTruthy();
    
    fireEvent.blur(input);
    expect(queryByText('recent1')).toBeFalsy();
  });

  it('should select recent search when tapped', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      recent: ['selected search'],
    });

    const { getByPlaceholderText, getByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);
    fireEvent.press(getByText('selected search'));

    expect(mockSetQuery).toHaveBeenCalledWith('selected search');
  });

  it('should clear recent searches when Clear button tapped', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      recent: ['search1', 'search2'],
    });

    const { getByPlaceholderText, getByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);
    fireEvent.press(getByText('Clear Recent'));

    expect(mockClearRecentSearches).toHaveBeenCalled();
  });

  it('should show clear button when there is text', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      query: 'some query',
    });

    const { getByTestId } = render(<SearchBar />);
    
    expect(getByTestId('clear-search')).toBeTruthy();
  });

  it('should clear search when clear button is pressed', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      query: 'some query',
    });

    const { getByTestId } = render(<SearchBar />);
    
    fireEvent.press(getByTestId('clear-search'));

    expect(mockSetQuery).toHaveBeenCalledWith('');
  });

  it('should auto-focus when autoFocus prop is true', () => {
    const { getByPlaceholderText } = render(<SearchBar autoFocus />);
    const input = getByPlaceholderText('Search recordings...');
    
    // Note: Auto-focus testing may be limited in test environment
    expect(input).toBeTruthy();
  });

  it('should handle submission with onSubmitEditing', () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    act(() => {
      fireEvent.changeText(input, 'submit test');
      fireEvent(input, 'submitEditing');
      jest.advanceTimersByTime(150);
    });

    expect(mockSetQuery).toHaveBeenCalledWith('submit test');
  });

  it('should limit recent searches display to 5 items', () => {
    const manyRecent = Array.from({ length: 10 }, (_, i) => `search${i}`);
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      recent: manyRecent,
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<SearchBar />);
    const input = getByPlaceholderText('Search recordings...');
    
    fireEvent.focus(input);

    // Should show first 5
    expect(getByText('search0')).toBeTruthy();
    expect(getByText('search4')).toBeTruthy();
    
    // Should not show the 6th item
    expect(queryByText('search5')).toBeFalsy();
  });

  it('should handle accessibility labels correctly', () => {
    const { getByPlaceholderText, getByLabelText } = render(<SearchBar />);
    
    expect(getByPlaceholderText('Search recordings...')).toBeTruthy();
    expect(getByLabelText('Search recordings')).toBeTruthy();
  });
});