import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  Text,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useSearch } from '../../lib/store/search';

interface SearchBarProps {
  autoFocus?: boolean;
  style?: any;
}

export function SearchBar({ autoFocus = false, style }: SearchBarProps) {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    query, 
    recent,
    setQuery, 
    clearQuery, 
    addRecentSearch,
    applyRecentSearch,
    clearRecentSearches
  } = useSearch();
  
  const [localQuery, setLocalQuery] = useState(query);
  const [showRecent, setShowRecent] = useState(false);
  
  // Sync with store when query changes externally
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);
  
  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);
  
  // Debounced search
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setQuery(searchQuery);
      
      // Add to recent searches when user stops typing (and query is not empty)
      const trimmed = searchQuery.trim();
      if (trimmed && trimmed !== query) {
        addRecentSearch(trimmed);
      }
    }, 150); // 150ms debounce as specified
  }, [setQuery, addRecentSearch, query]);
  
  const handleTextChange = (text: string) => {
    setLocalQuery(text);
    debouncedSearch(text);
  };
  
  const handleClear = () => {
    setLocalQuery('');
    clearQuery();
    setShowRecent(false);
    inputRef.current?.blur();
  };
  
  const handleFocus = () => {
    if (recent.length > 0) {
      setShowRecent(true);
    }
  };
  
  const handleBlur = () => {
    // Delay hiding recent searches to allow taps to register
    setTimeout(() => setShowRecent(false), 200);
  };
  
  const handleRecentPress = (recentQuery: string) => {
    setLocalQuery(recentQuery);
    applyRecentSearch(recentQuery);
    setShowRecent(false);
    inputRef.current?.blur();
  };
  
  const handleClearRecent = () => {
    clearRecentSearches();
    setShowRecent(false);
  };
  
  const styles = StyleSheet.create({
    container: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm,
      minHeight: 44,
    },
    searchInputFocused: {
      borderColor: theme.colors.primary,
    },
    searchIcon: {
      marginRight: theme.spacing.sm,
    },
    textInput: {
      flex: 1,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.text,
      paddingVertical: theme.spacing.sm,
    },
    clearButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    recentContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: theme.spacing.xs,
      maxHeight: 200,
    },
    recentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    recentHeaderText: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.textSecondary,
    },
    clearRecentButton: {
      padding: theme.spacing.xs,
    },
    clearRecentText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    recentItemLast: {
      borderBottomWidth: 0,
    },
    recentIcon: {
      marginRight: theme.spacing.sm,
    },
    recentText: {
      flex: 1,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.text,
    },
  });
  
  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.searchInputContainer,
        showRecent && styles.searchInputFocused
      ]}>
        <Ionicons 
          name="search" 
          size={20} 
          color={theme.colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={localQuery}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search in files"
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="search"
          accessibilityLabel="Search in files"
          accessibilityRole="searchbox"
        />
        {localQuery.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={handleClear}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <Ionicons 
              name="close-circle" 
              size={20} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Recent searches dropdown */}
      {showRecent && recent.length > 0 && (
        <View style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentHeaderText}>Recent searches</Text>
            <TouchableOpacity 
              style={styles.clearRecentButton}
              onPress={handleClearRecent}
              accessibilityLabel="Clear recent searches"
              accessibilityRole="button"
            >
              <Text style={styles.clearRecentText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {recent.map((recentQuery, index) => (
              <TouchableOpacity
                key={recentQuery}
                style={[
                  styles.recentItem,
                  index === recent.length - 1 && styles.recentItemLast
                ]}
                onPress={() => handleRecentPress(recentQuery)}
                accessibilityLabel={`Search for ${recentQuery}`}
                accessibilityRole="button"
              >
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={theme.colors.textSecondary}
                  style={styles.recentIcon}
                />
                <Text style={styles.recentText} numberOfLines={1}>
                  {recentQuery}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}