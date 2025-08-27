export const colors = {
  light: {
    primary: '#007AFF',
    primaryDark: '#0051D5',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    surfaceSecondary: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#007AFF',
  },
  dark: {
    primary: '#0A84FF',
    primaryDark: '#0051D5',
    secondary: '#5E5CE6',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    success: '#32D74B',
    warning: '#FF9F0A',
    error: '#FF453A',
    info: '#64D2FF',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type Colors = typeof colors.light | typeof colors.dark;
