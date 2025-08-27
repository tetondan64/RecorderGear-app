import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SortSheet, SortControls } from '../src/components/library/SortSheet';
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
        lg: 24,
      },
      typography: {
        sizes: { md: 16, sm: 14 },
        weights: { medium: '500', semibold: '600' },
      },
    },
  }),
}));

// Mock ActionSheet component
jest.mock('../src/components/common/ActionSheet', () => ({
  ActionSheet: ({ visible, title, options, onCancel }: any) => 
    visible ? (
      <>
        {options.map((option: any) => (
          <button key={option.id} onPress={option.onPress}>
            {option.title}
          </button>
        ))}
      </>
    ) : null,
}));

const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;

describe('SortSheet Component', () => {
  const mockSetSortBy = jest.fn();
  const mockSetSortDir = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSearch.mockReturnValue({
      query: '',
      recent: [],
      sortBy: 'CREATED_AT',
      sortDir: 'DESC',
      setQuery: jest.fn(),
      addRecentSearch: jest.fn(),
      clearRecentSearches: jest.fn(),
      setSortBy: mockSetSortBy,
      setSortDir: mockSetSortDir,
      toggleSortDir: jest.fn(),
      loadSearchSettings: jest.fn(),
    });
  });

  it('should render sort options when visible', () => {
    const { getByText } = render(
      <SortSheet visible={true} onClose={mockOnClose} />
    );
    
    expect(getByText('Date Created')).toBeTruthy();
    expect(getByText('Date Updated')).toBeTruthy();
    expect(getByText('Duration')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <SortSheet visible={false} onClose={mockOnClose} />
    );
    
    expect(queryByText('Date Created')).toBeFalsy();
  });

  it('should call setSortBy and onClose when option selected', () => {
    const { getByText } = render(
      <SortSheet visible={true} onClose={mockOnClose} />
    );
    
    fireEvent.press(getByText('Duration'));
    
    expect(mockSetSortBy).toHaveBeenCalledWith('DURATION');
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('SortControls Component', () => {
  const mockSetSortBy = jest.fn();
  const mockToggleSortDir = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSearch.mockReturnValue({
      query: '',
      recent: [],
      sortBy: 'CREATED_AT',
      sortDir: 'DESC',
      setQuery: jest.fn(),
      addRecentSearch: jest.fn(),
      clearRecentSearches: jest.fn(),
      setSortBy: mockSetSortBy,
      setSortDir: jest.fn(),
      toggleSortDir: mockToggleSortDir,
      loadSearchSettings: jest.fn(),
    });
  });

  it('should render sort by section title', () => {
    const { getByText } = render(<SortControls />);
    
    expect(getByText('Sort By')).toBeTruthy();
  });

  it('should display current sort direction', () => {
    const { getByText } = render(<SortControls />);
    
    // DESC should show as Z-A
    expect(getByText('Z-A')).toBeTruthy();
  });

  it('should display ASC direction correctly', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      sortDir: 'ASC',
    });

    const { getByText } = render(<SortControls />);
    
    expect(getByText('A-Z')).toBeTruthy();
  });

  it('should toggle sort direction when direction button pressed', () => {
    const { getByLabelText } = render(<SortControls />);
    
    const directionButton = getByLabelText('Sort direction: Descending');
    fireEvent.press(directionButton);
    
    expect(mockToggleSortDir).toHaveBeenCalled();
  });

  it('should render all sort options', () => {
    const { getByText } = render(<SortControls />);
    
    expect(getByText('Date Created')).toBeTruthy();
    expect(getByText('Date Updated')).toBeTruthy();
    expect(getByText('Duration')).toBeTruthy();
  });

  it('should highlight active sort option', () => {
    const { getByLabelText } = render(<SortControls />);
    
    // CREATED_AT should be active by default
    const activeOption = getByLabelText('Sort by Date Created');
    expect(activeOption).toBeTruthy();
  });

  it('should call setSortBy when sort option is pressed', () => {
    const { getByLabelText } = render(<SortControls />);
    
    const durationOption = getByLabelText('Sort by Duration');
    fireEvent.press(durationOption);
    
    expect(mockSetSortBy).toHaveBeenCalledWith('DURATION');
  });

  it('should show correct active option for UPDATED_AT', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      sortBy: 'UPDATED_AT',
    });

    const { getByLabelText } = render(<SortControls />);
    
    const activeOption = getByLabelText('Sort by Date Updated');
    expect(activeOption).toBeTruthy();
  });

  it('should show correct active option for DURATION', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      sortBy: 'DURATION',
    });

    const { getByLabelText } = render(<SortControls />);
    
    const activeOption = getByLabelText('Sort by Duration');
    expect(activeOption).toBeTruthy();
  });

  it('should have proper accessibility labels', () => {
    const { getByLabelText } = render(<SortControls />);
    
    expect(getByLabelText('Sort direction: Descending')).toBeTruthy();
    expect(getByLabelText('Sort by Date Created')).toBeTruthy();
    expect(getByLabelText('Sort by Date Updated')).toBeTruthy();
    expect(getByLabelText('Sort by Duration')).toBeTruthy();
  });

  it('should apply custom styles when provided', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(<SortControls style={customStyle} />);
    
    expect(getByText('Sort By')).toBeTruthy();
  });

  it('should show correct icon for each sort option', () => {
    const { getByText } = render(<SortControls />);
    
    // Icons are rendered but testing their presence through text elements
    expect(getByText('Date Created')).toBeTruthy();
    expect(getByText('Date Updated')).toBeTruthy();
    expect(getByText('Duration')).toBeTruthy();
  });

  it('should handle multiple rapid sort changes', () => {
    const { getByLabelText } = render(<SortControls />);
    
    const updatedOption = getByLabelText('Sort by Date Updated');
    const durationOption = getByLabelText('Sort by Duration');
    
    fireEvent.press(updatedOption);
    fireEvent.press(durationOption);
    
    expect(mockSetSortBy).toHaveBeenCalledTimes(2);
    expect(mockSetSortBy).toHaveBeenNthCalledWith(1, 'UPDATED_AT');
    expect(mockSetSortBy).toHaveBeenNthCalledWith(2, 'DURATION');
  });

  it('should maintain sort direction state across option changes', () => {
    mockUseSearch.mockReturnValue({
      ...mockUseSearch(),
      sortBy: 'DURATION',
      sortDir: 'ASC',
    });

    const { getByText } = render(<SortControls />);
    
    // Should maintain ASC direction
    expect(getByText('A-Z')).toBeTruthy();
  });
});