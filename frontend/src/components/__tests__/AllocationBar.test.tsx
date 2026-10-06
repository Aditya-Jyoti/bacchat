import React from 'react';

import { allocation } from '../../data';
import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { AllocationBar } from '../AllocationBar';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('AllocationBar (%s)', (mode) => {
  const c = khataPalette(45, mode);
  const segments = allocation.map((a, i) => ({
    name: a.name,
    amountText: a.amount.text,
    percent: parseFloat(a.w),
    color: [c.primary, c.chart2, c.chart4, c.onSurfaceVariant][i],
  }));

  it('renders one segment per item with 4dp minimum and a 2x2 legend', () => {
    const { getAllByTestId, getByText } = renderWithTheme(<AllocationBar segments={segments} />, mode);
    const segs = getAllByTestId('allocation-seg');
    expect(segs).toHaveLength(4);
    expect(flat(segs[0].props.style).flexBasis).toBe('53.5%');
    expect(flat(segs[3].props.style).minWidth).toBe(4);
    expect(flat(segs[1].props.style).backgroundColor).toBe(c.chart2);
    expect(getByText('Mutual funds & SIPs')).toBeTruthy();
    expect(getByText('\u20B95,31,150')).toBeTruthy();
  });

  it('has an accessibility summary', () => {
    const { getByLabelText } = renderWithTheme(<AllocationBar segments={segments} />, mode);
    expect(getByLabelText(/Asset allocation\. Mutual funds & SIPs \u20B99,86,400, 54 percent/)).toBeTruthy();
  });
});
