import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderWithTheme } from '../../../testUtils';
import K20_ComponentSheet1 from '../K20_ComponentSheet1';
import K29_ComponentSheet2 from '../K29_ComponentSheet2';

describe.each(['light', 'dark'] as const)('component galleries (%s host)', (mode) => {
  it('k20 renders every input, control and loader in both themes and responds', () => {
    const { getAllByText, getByTestId, getAllByTestId } = renderWithTheme(<K20_ComponentSheet1 />, mode);
    expect(getByTestId('sheet-light')).toBeTruthy();
    expect(getByTestId('sheet-dark')).toBeTruthy();
    for (const title of ['BUTTONS', 'TEXT FIELDS', 'SEARCH', 'AMOUNT + KEYPAD', 'SELECTION', 'SLIDERS', 'DATE & TIME', 'LOADERS', 'FEEDBACK', 'LIST ROWS', 'MENU']) {
      expect(getAllByText(title)).toHaveLength(2);
    }
    expect(getAllByText('Khata components')).toHaveLength(2);
    expect(getAllByText('Paid to').length).toBeGreaterThanOrEqual(2);
    expect(getAllByText('Updating fund prices\u2026')).toHaveLength(2);
    expect(getAllByTestId('skeleton-rows').length).toBe(2);
    fireEvent.press(getAllByTestId('key-5', { includeHiddenElements: true })[0]);
    expect(getAllByTestId('gallery-amount')[0].props.children).toBe('\u20B912495');
    fireEvent.press(getAllByTestId('date-10')[0]);
    fireEvent.press(getAllByTestId('chip-cash')[0]);
    expect(getAllByTestId('chip-cash')[0].props.accessibilityState.checked).toBe(true);
  });

  it('k29 renders overlays, steppers, app bars and amounts and responds', () => {
    const { getAllByText, getAllByTestId } = renderWithTheme(<K29_ComponentSheet2 />, mode);
    for (const title of ['TOOLTIPS', 'LONG-PRESS', 'GESTURES', 'SHEETS & MENUS', 'BANNERS & INLINE STATES', 'PROGRESS & STEPPERS', 'APP BARS & NAVIGATION', 'AMOUNTS']) {
      expect(getAllByText(title)).toHaveLength(2);
    }
    expect(getAllByText('Spendable money')).toHaveLength(2);
    fireEvent.press(getAllByTestId('tooltip-info')[0]);
    expect(getAllByTestId('tooltip-rich')).toHaveLength(1);
    fireEvent(getAllByTestId('long-press-amount')[0], 'longPress');
    expect(getAllByTestId('copied-snackbar')).toHaveLength(1);
    expect(getAllByText('63%')).toHaveLength(2);
    expect(getAllByText('3 selected')).toHaveLength(2);
    expect(getAllByText('Nothing here yet')).toHaveLength(2);
  });
});
