import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface TextFieldProps {
  value: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  selectAllOnFocus?: boolean;
  multiline?: boolean;
  maxLength?: number;
  style?: any;
}

export function TextField({
  value,
  placeholder,
  onSubmit,
  onCancel,
  autoFocus = true,
  selectAllOnFocus = true,
  multiline = false,
  maxLength,
  style,
}: TextFieldProps) {
  const { theme } = useTheme();
  const [text, setText] = useState(value);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Delay focus to ensure proper render
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        if (selectAllOnFocus) {
          inputRef.current?.setSelection(0, value.length);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, selectAllOnFocus]);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (trimmedText) {
      onSubmit(trimmedText);
    } else {
      onCancel?.();
    }
  };

  const handleKeyPress = ({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Enter' && !multiline) {
      handleSubmit();
    } else if (nativeEvent.key === 'Escape') {
      onCancel?.();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.md,
      marginVertical: theme.spacing.xs,
    },
    input: {
      flex: 1,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.text,
      padding: 0, // Remove default padding
      minHeight: multiline ? 60 : undefined,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        onBlur={handleSubmit}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        multiline={multiline}
        maxLength={maxLength}
        returnKeyType={multiline ? 'default' : 'done'}
        blurOnSubmit={!multiline}
      />
    </View>
  );
}