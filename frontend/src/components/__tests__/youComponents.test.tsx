import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { MonthStrip } from '../MonthStrip';
import { PairedBarChart } from '../PairedBarChart';
import { SkeletonLoader, SkeletonRows } from '../SkeletonLoader';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('PairedBarChart, MonthStrip, SkeletonLoader (%s)', (mode) => {
  const c = khataPalette(45, mode);
  const days = Array.from({ length: 28 }, (_, i) => (i < 14 ? 18 + i : i - 13));

  it('PairedBarChart scales columns, colours them and shows net kept on tap', () => {
    const { getByTestId, queryByTestId, getByText } = renderWithTheme(
      <PairedBarChart months={['May', 'Jun']} income={[10000000, 5000000]} spend={[5000000, 5000000]} height={100} />,
      mode,
    );
    expect(flat(getByTestId('paired-in-0').props.style).height).toBe(100);
    expect(flat(getByTestId('paired-out-0').props.style).height).toBe(50);
    expect(flat(getByTestId('paired-in-0').props.style).backgroundColor).toBe(c.primary);
    expect(flat(getByTestId('paired-out-0').props.style).backgroundColor).toBe(c.chart3);
    expect(getByTestId('paired-bar-chart').props.accessibilityLabel).toContain('May: in');
    expect(queryByTestId('paired-tooltip')).toBeNull();
    fireEvent.press(getByTestId('paired-col-0'));
    expect(getByTestId('paired-tooltip')).toBeTruthy();
    expect(getByText('May \u00B7 net kept \u20B950k')).toBeTruthy();
    fireEvent.press(getByTestId('paired-col-0'));
    expect(queryByTestId('paired-tooltip')).toBeNull();
  });

  it('MonthStrip highlights today and colours dots by kind', () => {
    const onSelect = jest.fn();
    const dots = [
      { index: 7, kind: 'sip' as const },
      { index: 10, kind: 'bill' as const },
    ];
    const { getByTestId, queryByTestId, getByText, rerender } = renderWithTheme(
      <MonthStrip days={days} todayIndex={6} dots={dots} onSelect={onSelect} />,
      mode,
    );
    expect(getByText('24')).toBeTruthy();
    expect(flat(getByTestId('month-dot-7').props.style).backgroundColor).toBe(c.chart2);
    expect(flat(getByTestId('month-dot-10').props.style).backgroundColor).toBe(c.primary);
    expect(getByTestId('month-cell-6').props.accessibilityLabel).toBe('24, today');
    fireEvent.press(getByTestId('month-cell-7'));
    expect(onSelect).toHaveBeenCalledWith(7);
    rerender(
      <ThemeProvider mode={mode}>
        <MonthStrip days={days} todayIndex={6} dots={dots} visibleKinds={['bill']} />
      </ThemeProvider>,
    );
    expect(queryByTestId('month-dot-7')).toBeNull();
    expect(getByTestId('month-dot-10')).toBeTruthy();
  });

  it('SkeletonLoader renders bars in surfaceContainerHigh', () => {
    const { getByTestId } = renderWithTheme(<SkeletonLoader width={40} height={10} />, mode);
    const s = flat(getByTestId('skeleton', { includeHiddenElements: true }).props.style);
    expect(s.backgroundColor).toBe(c.surfaceContainerHigh);
    expect(s.width).toBe(40);
    const rows = renderWithTheme(<SkeletonRows count={2} />, mode);
    expect(rows.getAllByTestId('skeleton-circle', { includeHiddenElements: true })).toHaveLength(2);
    expect(rows.getByTestId('skeleton-rows').props.accessibilityLabel).toBe('Loading');
  });
});
