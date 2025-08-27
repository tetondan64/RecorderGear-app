import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  runOnJS 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

/**
 * Lightweight toast notification component
 */

export interface ToastConfig {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastProps {
  toast: ToastConfig;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (toast.type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          background: '#10B981',
          text: '#FFFFFF',
          icon: '#FFFFFF',
        };
      case 'error':
        return {
          background: '#EF4444',
          text: '#FFFFFF', 
          icon: '#FFFFFF',
        };
      case 'warning':
        return {
          background: '#F59E0B',
          text: '#FFFFFF',
          icon: '#FFFFFF',
        };
      case 'info':
        return {
          background: theme.colors.primary,
          text: '#FFFFFF',
          icon: '#FFFFFF',
        };
    }
  };

  const colors = getColors();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const hide = () => {
    translateY.value = withTiming(-100, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(onDismiss)(toast.id);
    });
  };

  useEffect(() => {
    // Show animation
    translateY.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(1, { duration: 300 });

    // Auto-hide after duration
    const duration = toast.duration || 4000;
    const timer = setTimeout(hide, duration);

    return () => clearTimeout(timer);
  }, []);

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: insets.top + theme.spacing.sm,
      left: theme.spacing.md,
      right: theme.spacing.md,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    iconContainer: {
      marginRight: theme.spacing.sm,
    },
    content: {
      flex: 1,
    },
    message: {
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.medium,
      color: colors.text,
    },
    action: {
      marginLeft: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    actionText: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.semibold,
      color: colors.text,
    },
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getIconName()} 
          size={24} 
          color={colors.icon} 
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.message}>{toast.message}</Text>
      </View>
      
      {toast.action && (
        <View style={styles.action}>
          <Text 
            style={styles.actionText}
            onPress={toast.action.onPress}
          >
            {toast.action.label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// Toast manager for global state
class ToastManager {
  private toasts: ToastConfig[] = [];
  private listeners: ((toasts: ToastConfig[]) => void)[] = [];

  show(config: Omit<ToastConfig, 'id'>): string {
    const id = Date.now().toString();
    const toast: ToastConfig = { id, ...config };
    
    this.toasts.push(toast);
    this.notifyListeners();
    
    return id;
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notifyListeners();
  }

  dismissAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  subscribe(listener: (toasts: ToastConfig[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }
}

export const toastManager = new ToastManager();

// Toast container component
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  return (
    <>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={toastManager.dismiss.bind(toastManager)}
        />
      ))}
    </>
  );
}

// Convenience functions
export const Toast = {
  show: (config: Omit<ToastConfig, 'id'>) => toastManager.show(config),
  success: (message: string, duration?: number) => 
    toastManager.show({ message, type: 'success', duration }),
  error: (message: string, duration?: number) => 
    toastManager.show({ message, type: 'error', duration }),
  info: (message: string, duration?: number) => 
    toastManager.show({ message, type: 'info', duration }),
  warning: (message: string, duration?: number) => 
    toastManager.show({ message, type: 'warning', duration }),
  dismiss: (id: string) => toastManager.dismiss(id),
  dismissAll: () => toastManager.dismissAll(),
};