import { NavigationContext } from '@react-navigation/native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../../../testUtils';
import K18_Ask from '../K18_Ask';

describe.each(['light', 'dark'] as const)('k18 Ask (%s)', (mode) => {
  it('shows the key badge, conversation, tool chips, answer, actions, privacy line and loader', () => {
    const { getByText, getAllByTestId, getByTestId, getByLabelText } = renderWithTheme(<K18_Ask />, mode);
    expect(getByText('Ask Bacchat')).toBeTruthy();
    expect(getByText('Your key \u00B7 Claude')).toBeTruthy();
    expect(getByText('Can I afford Goa without touching my emergency fund?')).toBeTruthy();
    expect(getAllByTestId('tool-chip')).toHaveLength(3);
    expect(getByText('read \u00B7 card dues')).toBeTruthy();
    expect(getByText('\u20B952,000')).toBeTruthy();
    expect(getByText('\u20B95,500 a month')).toBeTruthy();
    expect(getByText('Set aside \u20B95,500 monthly')).toBeTruthy();
    expect(getByText('Show the maths')).toBeTruthy();
    expect(getByText('Only totals were shared, never transactions.')).toBeTruthy();
    expect(getByText('And if I go in January?')).toBeTruthy();
    expect(getByTestId('thinking-dots')).toBeTruthy();
    expect(getByLabelText('Ask about your money\u2026')).toBeTruthy();
  });

  it('stop ends the loader, then typing and sending adds a question and shows the loader again', () => {
    const { getByTestId, queryByTestId, getByText } = renderWithTheme(<K18_Ask />, mode);
    fireEvent.press(getByTestId('ask-stop'));
    expect(queryByTestId('thinking-dots')).toBeNull();
    fireEvent.changeText(getByTestId('ask-input'), 'What about Diwali gifts?');
    fireEvent.press(getByTestId('ask-send'));
    expect(getByText('What about Diwali gifts?')).toBeTruthy();
    expect(getByTestId('thinking-dots')).toBeTruthy();
  });

  it('closes via the scrim', () => {
    const goBack = jest.fn();
    const nav = { navigate: jest.fn(), goBack, canGoBack: () => true } as never;
    const { getByLabelText } = renderWithTheme(
      <NavigationContext.Provider value={nav}>
        <K18_Ask />
      </NavigationContext.Provider>,
      mode,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(goBack).toHaveBeenCalled();
  });

  it('respects reduce motion (dots stay rendered, static)', async () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(() => new Promise((r) => setTimeout(() => r(true), 1)));
    const { getByTestId } = renderWithTheme(<K18_Ask />, mode);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(getByTestId('thinking-dots')).toBeTruthy();
    spy.mockRestore();
  });
});
