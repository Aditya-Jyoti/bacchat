import React, { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { AmountKeypad, KEYPAD_KEYS, applyKey, formatAmountDisplay } from '../AmountKeypad';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

function Harness({ start = '' }: { start?: string }) {
  const [v, setV] = useState(start);
  return (
    <>
      <Text testID="value">{v}</Text>
      <AmountKeypad value={v} onChange={setV} />
    </>
  );
}

describe('applyKey', () => {
  it('types digits and drops leading zeros', () => {
    expect(applyKey('', '0')).toBe('0');
    expect(applyKey('0', '5')).toBe('5');
    expect(applyKey('12', '4')).toBe('124');
  });
  it('allows one decimal point and two decimals', () => {
    expect(applyKey('', '.')).toBe('0.');
    expect(applyKey('12', '.')).toBe('12.');
    expect(applyKey('12.5', '.')).toBe('12.5');
    expect(applyKey('12.55', '7')).toBe('12.55');
  });
  it('limits whole digits and backspaces', () => {
    expect(applyKey('123456789', '1')).toBe('123456789');
    expect(applyKey('12', 'backspace')).toBe('1');
    expect(applyKey('', 'backspace')).toBe('');
    expect(applyKey('12', 'x')).toBe('12');
  });
});

describe('formatAmountDisplay', () => {
  it('uses Indian grouping and keeps a trailing point', () => {
    expect(formatAmountDisplay('')).toBe('0');
    expect(formatAmountDisplay('1249')).toBe('1,249');
    expect(formatAmountDisplay('1234567')).toBe('12,34,567');
    expect(formatAmountDisplay('12.')).toBe('12.');
    expect(formatAmountDisplay('1000.5')).toBe('1,000.5');
  });
});

describe.each(['light', 'dark'] as const)('AmountKeypad (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('renders 12 keys, 44dp tall, with 6dp gaps', () => {
    const { getByTestId } = renderWithTheme(<Harness />, mode);
    expect(KEYPAD_KEYS).toHaveLength(12);
    for (const k of KEYPAD_KEYS) {
      expect(flat(getByTestId(`key-${k}`).props.style).height).toBe(44);
    }
    expect(flat(getByTestId('key-1').props.style).backgroundColor).toBe(c.surface);
    expect(flat(getByTestId('key-backspace').props.style).backgroundColor).toBe(c.secondaryContainer);
    const panel = flat(getByTestId('amount-keypad').props.style);
    expect(panel.gap).toBe(8);
  });

  it('types an amount and backspaces', () => {
    const { getByTestId } = renderWithTheme(<Harness />, mode);
    for (const k of ['1', '2', '4', '9']) fireEvent.press(getByTestId(`key-${k}`));
    expect(getByTestId('value').props.children).toBe('1249');
    fireEvent.press(getByTestId('key-backspace'));
    expect(getByTestId('value').props.children).toBe('124');
    fireEvent.press(getByTestId('key-.'));
    fireEvent.press(getByTestId('key-5'));
    expect(getByTestId('value').props.children).toBe('124.5');
  });

  it('quick-add chips add rupees', () => {
    const { getByTestId } = renderWithTheme(<Harness start="280" />, mode);
    fireEvent.press(getByTestId('quick-add-500'));
    expect(getByTestId('value').props.children).toBe('780');
    fireEvent.press(getByTestId('quick-add-100'));
    expect(getByTestId('value').props.children).toBe('880');
  });

  it('labels keys for TalkBack', () => {
    const { getByLabelText } = renderWithTheme(<Harness />, mode);
    expect(getByLabelText('Delete')).toBeTruthy();
    expect(getByLabelText('Decimal point')).toBeTruthy();
    expect(getByLabelText('7')).toBeTruthy();
  });
});
