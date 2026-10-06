import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from './theme/ThemeProvider';
import type { ColorMode } from './theme/types';

/** Render a component inside the Bacchat ThemeProvider (light by default). */
export function renderWithTheme(ui: React.ReactElement, mode: ColorMode = 'light') {
  return render(<ThemeProvider mode={mode}>{ui}</ThemeProvider>);
}
