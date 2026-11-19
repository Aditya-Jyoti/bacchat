/** k3 headline: the month's balance (in less out), green when kept, red when more went out. */
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { khataPalette } from '../../../theme';
import K3 from '../K3_MoneySummary';
import { renderScreen } from './helpers';

const R = '₹';
const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
const base = { categoryId: null, accountId: 'sb', method: 'upi' as const, sources: [{ kind: 'hand' as const }], status: 'confirmed' as const, aiAdded: false };

describe.each(['light', 'dark'] as const)('k3 month balance (%s)', (mode) => {
  it('spending more than came in shows the gap in red with words, and in and out beside it', async () => {
    const db = createMemoryDb();
    await db.accounts.put({ id: 'sb', name: 'Savings', kind: 'bank', balancePaise: 0, icon: 'a' });
    await db.entries.putMany([
      { ...base, id: 'in1', amountPaise: 2200000, direction: 'in', at: new Date(2026, 9, 9, 12).getTime(), merchant: 'Aadivishnu' },
      { ...base, id: 'o1', amountPaise: 2000000, direction: 'out', at: new Date(2026, 9, 5, 12).getTime(), merchant: 'Apollo Hospitals' },
      { ...base, id: 'o2', amountPaise: 569000, direction: 'out', at: new Date(2026, 9, 12, 12).getTime(), merchant: 'Blinkit' },
    ]);
    const { findByText, getByTestId } = renderScreen(<K3 />, mode, undefined, undefined, { db, servicesOptions: { seed: false, now: () => NOW } });
    expect(await findByText('More out than in so far')).toBeTruthy();
    const net = getByTestId('month-net-amount');
    expect(net.props.children).toBe(`-${R}3,690`);
    expect(flat(net.props.style).color).toBe(khataPalette(45, mode).moneyOut);
    expect(getByTestId('month-in')).toHaveTextContent(`In ${R}22,000`);
    expect(getByTestId('month-out')).toHaveTextContent(`Out ${R}25,690`);
  });
});
