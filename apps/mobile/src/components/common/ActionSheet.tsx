import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export interface ActionSheetOption {
  id: string;
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isDestructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onCancel: () => void;
}

export function ActionSheet({
  visible,
  title,
  options,
  onCancel,
}: ActionSheetProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: theme.spacing.xl,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    optionsContainer: {
      paddingHorizontal: theme.spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: 8,
      marginBottom: theme.spacing.xs,
    },
    optionIcon: {
      marginRight: theme.spacing.md,
    },
    optionText: {
      flex: 1,
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.medium,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
    },
    cancelOption: {
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    cancelText: {
      color: theme.colors.text,
      textAlign: 'center',
    },
  });

  const handleOptionPress = (option: ActionSheetOption) => {
    onCancel(); // Close the sheet first
    // Small delay to allow animation to complete
    setTimeout(() => {
      option.onPress();
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity 
          style={styles.container} 
          activeOpacity={1}
          onPress={() => {}} // Prevent dismiss when tapping container
        >
          <View style={styles.handle} />
          
          {title && <Text style={styles.title}>{title}</Text>}
          
          <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={styles.option}
                onPress={() => handleOptionPress(option)}
                accessibilityRole="button"
                accessibilityLabel={option.title}
              >
                {option.icon && (
                  <View style={styles.optionIcon}>
                    <Ionicons 
                      name={option.icon} 
                      size={20} 
                      color={option.isDestructive ? theme.colors.error : theme.colors.text} 
                    />
                  </View>
                )}
                <Text 
                  style={[
                    styles.optionText,
                    { color: option.isDestructive ? theme.colors.error : theme.colors.text }
                  ]}
                >
                  {option.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.option, styles.cancelOption]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.optionText, styles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}