import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { normalizeSearchText } from '../../lib/store/search';

interface HighlightProps {
  text: string;
  query: string;
  style?: TextStyle;
  highlightStyle?: TextStyle;
}

interface TextSegment {
  text: string;
  isHighlighted: boolean;
}

/**
 * Find all occurrences of query in text (case and diacritics insensitive)
 * Returns array of segments with highlight information
 */
function segmentText(text: string, query: string): TextSegment[] {
  if (!query.trim()) {
    return [{ text, isHighlighted: false }];
  }
  
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  
  if (!normalizedText.includes(normalizedQuery)) {
    return [{ text, isHighlighted: false }];
  }
  
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let searchIndex = 0;
  
  while (searchIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, searchIndex);
    
    if (matchIndex === -1) {
      // No more matches - add remaining text
      if (lastIndex < text.length) {
        segments.push({
          text: text.substring(lastIndex),
          isHighlighted: false,
        });
      }
      break;
    }
    
    // Add text before match
    if (matchIndex > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, matchIndex),
        isHighlighted: false,
      });
    }
    
    // Add highlighted match (use original text casing)
    segments.push({
      text: text.substring(matchIndex, matchIndex + normalizedQuery.length),
      isHighlighted: true,
    });
    
    lastIndex = matchIndex + normalizedQuery.length;
    searchIndex = lastIndex;
  }
  
  return segments;
}

export function Highlight({ text, query, style, highlightStyle }: HighlightProps) {
  const { theme } = useTheme();
  
  const segments = segmentText(text, query);
  
  const defaultHighlightStyle: TextStyle = {
    fontWeight: theme.typography.weights.semibold,
    backgroundColor: theme.colors.primary + '20',
    color: theme.colors.primary,
  };
  
  const finalHighlightStyle = {
    ...defaultHighlightStyle,
    ...highlightStyle,
  };
  
  return (
    <Text style={style}>
      {segments.map((segment, index) => (
        <Text
          key={index}
          style={segment.isHighlighted ? finalHighlightStyle : undefined}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Simple hook to check if text contains query (for conditional rendering)
 */
export function useTextMatches(text: string, query: string): boolean {
  if (!query.trim()) return false;
  
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  
  return normalizedText.includes(normalizedQuery);
}