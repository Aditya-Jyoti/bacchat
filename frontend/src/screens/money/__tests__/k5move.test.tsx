/** k5 Moved: a self-transfer between your own accounts (From and To), never spending or income. */
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import K5 from '../K5_AddEntry';
import { rowFor } from '../parts/live';
import { renderLive } from './helpers';

describe.each(['light', 'dark'] as const)('k5 Moved (%s)', (mode) => {
  it('records a move from one account to another, with no payee or category asked', async () => {
    const r = await renderLive(<K5 />, mode);
    await waitFor(() => expect(r.getByTestId('method-field')).toBeTruthy());
    fireEvent.press(r.getByTestId('kind-moved'));
    expect(r.queryByTestId('payee-input')).toBeNull();
    expect(r.queryByTestId('category-field')).toBeNull();
    expect(r.getByText('From')).toBeTruthy();
    fireEvent.press(r.getByTestId('method-field'));
    fireEvent.press(r.getByTestId('method-HDFC Savings'));
    fireEvent.press(r.getByTestId('move-to-field'));
    fireEvent.press(r.getByTestId('move-to-Cash wallet'));
    fireEvent.changeText(r.getByTestId('amount'), '3000');
    fireEvent.press(r.getByTestId('save'));
    await waitFor(async () => {
      const move = (await r.services.db.entries.list()).find((e) => e.transferToAccountId === 'acc-cash');
      expect(move).toMatchObject({ accountId: 'acc-hdfc', direction: 'out', amountPaise: 300000, categoryId: null, merchant: 'To Cash wallet' });
    });
  });

  it('turns money that came in into a move: it went to that account, from the one you pick', async () => {
    const r = await renderLive(<K5 />, mode);
    await waitFor(() => expect(r.getByTestId('method-field')).toBeTruthy());
    fireEvent.press(r.getByTestId('kind-got'));
    fireEvent.press(r.getByTestId('method-field'));
    fireEvent.press(r.getByTestId('method-HDFC Savings'));
    fireEvent.press(r.getByTestId('kind-moved'));
    expect(r.getByTestId('move-to-field').props.accessibilityLabel ?? '').toBeDefined();
    fireEvent.changeText(r.getByTestId('amount'), '3000');
    fireEvent.press(r.getByTestId('save'));
    await waitFor(async () => {
      const move = (await r.services.db.entries.list()).find((e) => e.transferToAccountId === 'acc-hdfc');
      expect(move).toBeTruthy();
      expect(move?.accountId).not.toBe('acc-hdfc');
    });
  });
});

it('a move shows as Moved in the entries list', () => {
  const acc = (id: string, name: string) => [id, { id, name, kind: 'bank', icon: 'x', balancePaise: 0, updatedAt: 0 }] as const;
  const lk = { cats: new Map(), accounts: new Map([acc('sbi', 'SBI Savings'), acc('slice', 'Slice Savings')]), upis: new Map() } as never;
  const e = { id: 'm', amountPaise: 300000, direction: 'out', at: 0, merchant: 'To Slice Savings', note: null, categoryId: null, accountId: 'sbi', method: 'bank', upiId: null, sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false, transferToAccountId: 'slice', updatedAt: 0 } as never;
  expect(rowFor(e, lk).sub).toBe('Moved · SBI Savings');
});
