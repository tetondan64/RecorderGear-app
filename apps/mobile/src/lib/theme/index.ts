import { colors, type ColorScheme, type Colors } from './colors';
import { spacing, type Spacing } from './spacing';
import { typography, type Typography } from './typography';

export { colors, type ColorScheme, type Colors } from './colors';
export { spacing, type Spacing } from './spacing';
export { typography, type Typography } from './typography';

export interface Theme {
  colors: Colors;
  spacing: Spacing;
  typography: Typography;
  isDark: boolean;
}

export const createTheme = (colorScheme: ColorScheme): Theme => ({
  colors: colors[colorScheme],
  spacing,
  typography,
  isDark: colorScheme === 'dark',
});
