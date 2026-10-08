/** Charts and bars never produce NaN or Infinity when there is little or no data. */
import React from 'react';

import { renderWithTheme } from '../../testUtils';
import { AllocationBar } from '../AllocationBar';
import { DailyBars } from '../DailyBars';
import { NetWorthChart } from '../NetWorthChart';
import { OwnOweBar } from '../OwnOweBar';
import { PaceBar } from '../PaceBar';
import { PairedBarChart } from '../PairedBarChart';
import { SegmentedProgress } from '../SegmentedProgress';

type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null };
function dump(n: unknown): string {
  const node = n as Json | Json[] | null;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(dump).join(' ');
  const own = JSON.stringify(node.props ?? {}, (_k, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? `BAD${String(v)}` : v));
  return `${own} ${(node.children ?? []).map((c) => (typeof c === 'string' ? c : dump(c))).join(' ')}`;
}
const BAD = /BAD|NaN|Infinity|undefined/;
const fmt = (v: number): string => `v${v}`;

describe.each(['light', 'dark'] as const)('charts with no data (%s)', (mode) => {
  it.each([[[]], [[5]], [[0, 0]], [[3, 3, 3]]])('NetWorthChart with %j', (values) => {
    const { toJSON, getByTestId } = renderWithTheme(<NetWorthChart values={values} labels={values.map((_, i) => `L${i}`)} formatValue={fmt} />, mode);
    expect(getByTestId('networth-chart')).toBeTruthy();
    expect(dump(toJSON())).not.toMatch(BAD);
  });

  it('NetWorthChart with no labels', () => {
    const { toJSON } = renderWithTheme(<NetWorthChart values={[]} labels={[]} formatValue={fmt} />, mode);
    expect(dump(toJSON())).not.toMatch(BAD);
  });

  it('DailyBars with no values and no days', () => {
    const { toJSON } = renderWithTheme(<DailyBars values={[]} daysInMonth={0} todayIndex={0} selectedIndex={null} onSelect={() => undefined} />, mode);
    expect(dump(toJSON())).not.toMatch(BAD);
  });

  it('DailyBars with a month of zeros', () => {
    const { toJSON } = renderWithTheme(<DailyBars values={[0, 0, 0]} daysInMonth={31} todayIndex={2} selectedIndex={null} onSelect={() => undefined} />, mode);
    expect(dump(toJSON())).not.toMatch(BAD);
  });

  it('PairedBarChart with no months and with zeros', () => {
    const a = renderWithTheme(<PairedBarChart months={[]} income={[]} spend={[]} />, mode);
    expect(dump(a.toJSON())).not.toMatch(BAD);
    const b = renderWithTheme(<PairedBarChart months={['May', 'Jun']} income={[0, 0]} spend={[0, 0]} initialSelected={1} />, mode);
    expect(dump(b.toJSON())).not.toMatch(BAD);
  });

  it('AllocationBar with nothing and with a NaN share', () => {
    const a = renderWithTheme(<AllocationBar segments={[]} />, mode);
    expect(dump(a.toJSON())).not.toMatch(BAD);
    const b = renderWithTheme(<AllocationBar segments={[{ name: 'Cash', amountText: '0', percent: NaN, color: 'x' }]} />, mode);
    expect(dump(b.toJSON())).not.toMatch(BAD);
  });

  it('OwnOweBar, PaceBar and SegmentedProgress with zero totals', () => {
    const a = renderWithTheme(<OwnOweBar ownPaise={0} owePaise={0} />, mode);
    expect(dump(a.toJSON())).not.toMatch(BAD);
    const b = renderWithTheme(<PaceBar fraction={0 / 0} todayFraction={NaN} accessibilityLabel="x" />, mode);
    expect(dump(b.toJSON())).not.toMatch(BAD);
    const c = renderWithTheme(<SegmentedProgress fraction={NaN} />, mode);
    expect(dump(c.toJSON())).not.toMatch(BAD);
  });
});
