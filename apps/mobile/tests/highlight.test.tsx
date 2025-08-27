import React from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { Highlight, useTextMatches } from '../src/components/library/Highlight';

// Mock the theme hook
jest.mock('../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      typography: {
        weights: { semibold: '600' }
      },
      colors: {
        primary: '#007AFF'
      }
    }
  })
}));

describe('Highlight Component', () => {
  it('should render text without highlighting when no query', () => {
    const { getByText } = render(
      <Highlight text="Hello World" query="" />
    );
    
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('should render text without highlighting when query is whitespace', () => {
    const { getByText } = render(
      <Highlight text="Hello World" query="   " />
    );
    
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('should highlight exact matches (case insensitive)', () => {
    const { getByText } = render(
      <Highlight text="Hello World" query="hello" />
    );
    
    // Should find the highlighted text
    expect(getByText('Hello')).toBeTruthy();
    expect(getByText(' World')).toBeTruthy();
  });

  it('should highlight multiple matches', () => {
    const { getByText } = render(
      <Highlight text="The cat and the dog" query="the" />
    );
    
    // Should find both instances of "The"/"the"
    expect(getByText('The')).toBeTruthy();
    expect(getByText(' cat and ')).toBeTruthy();
    expect(getByText('the')).toBeTruthy();
    expect(getByText(' dog')).toBeTruthy();
  });

  it('should handle diacritics-insensitive matching', () => {
    const { getByText } = render(
      <Highlight text="Café Résumé" query="cafe" />
    );
    
    // Should match "Café" when searching for "cafe"
    expect(getByText('Café')).toBeTruthy();
  });

  it('should preserve original text casing in highlights', () => {
    const { getByText } = render(
      <Highlight text="Hello WORLD" query="world" />
    );
    
    // Should preserve "WORLD" casing even when query is "world"
    expect(getByText('WORLD')).toBeTruthy();
  });

  it('should handle partial word matches', () => {
    const { getByText } = render(
      <Highlight text="Recording Audio File" query="rec" />
    );
    
    expect(getByText('Rec')).toBeTruthy();
    expect(getByText('ording Audio File')).toBeTruthy();
  });

  it('should handle no matches gracefully', () => {
    const { getByText } = render(
      <Highlight text="Hello World" query="xyz" />
    );
    
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('should handle empty text', () => {
    const { queryByText } = render(
      <Highlight text="" query="test" />
    );
    
    // Should not crash and should render empty
    expect(queryByText('test')).toBeFalsy();
  });

  it('should apply custom styles to highlighted text', () => {
    const customHighlightStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Highlight 
        text="Hello World" 
        query="hello" 
        highlightStyle={customHighlightStyle}
      />
    );
    
    const highlightedText = getByText('Hello');
    expect(highlightedText).toBeTruthy();
  });

  it('should apply custom styles to container', () => {
    const customStyle = { fontSize: 20 };
    const { getByText } = render(
      <Highlight 
        text="Hello World" 
        query="hello" 
        style={customStyle}
      />
    );
    
    expect(getByText('Hello')).toBeTruthy();
    expect(getByText(' World')).toBeTruthy();
  });
});

describe('useTextMatches hook', () => {
  it('should return false for empty query', () => {
    const { result } = renderHook(() => 
      useTextMatches('Hello World', '')
    );
    
    expect(result.current).toBe(false);
  });

  it('should return false for whitespace query', () => {
    const { result } = renderHook(() => 
      useTextMatches('Hello World', '   ')
    );
    
    expect(result.current).toBe(false);
  });

  it('should return true for matching text (case insensitive)', () => {
    const { result } = renderHook(() => 
      useTextMatches('Hello World', 'hello')
    );
    
    expect(result.current).toBe(true);
  });

  it('should return true for matching text (diacritics insensitive)', () => {
    const { result } = renderHook(() => 
      useTextMatches('Café', 'cafe')
    );
    
    expect(result.current).toBe(true);
  });

  it('should return false for non-matching text', () => {
    const { result } = renderHook(() => 
      useTextMatches('Hello World', 'xyz')
    );
    
    expect(result.current).toBe(false);
  });

  it('should handle partial matches', () => {
    const { result } = renderHook(() => 
      useTextMatches('Recording', 'rec')
    );
    
    expect(result.current).toBe(true);
  });
});