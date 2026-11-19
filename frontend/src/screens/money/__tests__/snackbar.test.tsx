/** Snackbar: closes itself after SNACKBAR_MS (the delete toast used to stay until the app restarted). */
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';

import { Snackbar, SNACKBAR_MS } from '../parts/Snackbar';
import { renderWithTheme } from '../../../testUtils';

describe.each(['light', 'dark'] as const)('Snackbar (%s)', (mode) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('dismisses itself after a few seconds', () => {
    const onDismiss = jest.fn();
    renderWithTheme(<Snackbar label="Blinkit deleted" onUndo={() => undefined} onDismiss={onDismiss} />, mode);
    act(() => jest.advanceTimersByTime(SNACKBAR_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Undo still works while it shows', () => {
    const onUndo = jest.fn();
    const { getByTestId } = renderWithTheme(<Snackbar label="3 deleted" onUndo={onUndo} onDismiss={() => undefined} />, mode);
    fireEvent.press(getByTestId('undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
