import React from 'react';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { OwnOweBar } from '../OwnOweBar';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('OwnOweBar (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('draws two segments in proportion with own in primary and owe in chart3', () => {
    const { getByTestId } = renderWithTheme(<OwnOweBar ownPaise={184235000} owePaise={2000000} />, mode);
    const own = flat(getByTestId('own-seg').props.style);
    const owe = flat(getByTestId('owe-seg').props.style);
    expect(own.backgroundColor).toBe(c.primary);
    expect(owe.backgroundColor).toBe(c.chart3);
    expect(own.flex as number).toBeGreaterThan(0.98);
    expect(owe.minWidth).toBe(4);
  });

  it('exposes an accessibility summary and legend', () => {
    const { getByLabelText, getByText } = renderWithTheme(<OwnOweBar ownPaise={184235000} owePaise={2000000} />, mode);
    expect(getByLabelText('You own \u20B918,42,350, you owe \u20B920,000')).toBeTruthy();
    expect(getByText('You owe')).toBeTruthy();
  });
});
