/** Pending ingest conflicts: banner on k4, list from k24, both candidates shown, calm resolve. */
import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb, type BacchatDb } from '../../../data/db';
import type { Entry } from '../../../data/db/models';
import { usePreferences } from '../../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import { addPending } from '../../../services/ingestPending';
import K24_Settings from '../../you/K24_Settings';
import K4 from '../K4_MoneyEntries';
import { renderScreen } from './helpers';

/** Polls with real timers; RNTL waitFor is slow on this tree. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(done()).toBe(true);
}

const NOW = new Date(2026, 9, 24, 20, 30).getTime();
const AT = new Date(2026, 9, 24, 15, 11).getTime();

async function seed(db: BacchatDb): Promise<void> {
  const e: Entry = {
    id: 'e-amazon',
    updatedAt: 0,
    amountPaise: 129900,
    direction: 'out',
    at: AT,
    merchant: 'Amazon',
    note: null,
    categoryId: null,
    accountId: null,
    method: 'upi',
    upiId: null,
    sources: [{ kind: 'mail' }],
    status: 'confirmed',
    aiAdded: false,
  };
  await db.entries.put(e);
  await addPending(db, {
    id: 'sms:abc:2026-10-24',
    againstId: 'e-amazon',
    addedAt: NOW,
    candidate: {
      amountPaise: 124900, direction: 'out', merchant: 'AMAZON PAY', at: AT + 60000, timeKnown: true, method: 'upi', cardLast4: null,
      accountLast4: null, upiHandle: null, upiRef: null, balancePaise: null, source: 'sms', confidence: 0.9, rawRef: 'sms:abc:2026-10-24',
    },
  });
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ smsIngestEnabled: false, smsBackfilledAt: null });
});

const render = async (ui: React.ReactElement, mode: 'light' | 'dark', withPending = true) => {
  const db = createMemoryDb();
  if (withPending) await seed(db);
  return { db, ...renderScreen(ui, mode, undefined, undefined, { db, servicesOptions: { seed: false, now: () => NOW } }) };
};

describe.each(['light', 'dark'] as const)('pending conflicts (%s)', (mode) => {
  it('k4 shows a banner and the sheet lists both candidates', async () => {
    const { findByTestId, getByTestId, getByText, findByText } = await render(<K4 />, mode);
    expect(await findByText(/Some messages look like entries you already have/)).toBeTruthy();
    fireEvent.press(getByText('Have a look'));
    expect(await findByTestId('pending-existing-sms:abc:2026-10-24')).toBeTruthy();
    expect(getByTestId('pending-message-sms:abc:2026-10-24')).toBeTruthy();
    expect(getByTestId('pending-existing-sms:abc:2026-10-24').props.accessibilityLabel).toContain('1,299');
    expect(getByTestId('pending-message-sms:abc:2026-10-24').props.accessibilityLabel).toContain('1,249');
  });

  it('keep both adds the message as its own To review entry and clears the banner', async () => {
    const { db, findByTestId, getByTestId, queryByTestId, getByText } = await render(<K4 />, mode);
    await findByTestId('pending-banner');
    fireEvent.press(getByText('Have a look'));
    fireEvent.press(await findByTestId('pending-option-keepBoth'));
    fireEvent.press(getByTestId('pending-use-sms:abc:2026-10-24'));
    await until(() => queryByTestId('pending-banner') === null);
    const all = await db.entries.list();
    expect(all).toHaveLength(2);
    expect(all.some((e) => e.status === 'toReview')).toBe(true);
  });

  it('keep mine adds a second source and no new entry', async () => {
    const { db, findByTestId, getByTestId, getByText, findByText } = await render(<K4 />, mode);
    await findByTestId('pending-banner');
    fireEvent.press(getByText('Have a look'));
    fireEvent.press(await findByTestId('pending-use-sms:abc:2026-10-24'));
    await findByText('Nothing waiting. All messages are sorted.');
    const all = await db.entries.list();
    expect(all).toHaveLength(1);
    expect(all[0].sources.length).toBe(2);
    expect(getByTestId('pending-empty')).toBeTruthy();
  });

  it('no banner when nothing is waiting', async () => {
    const { queryByTestId, findByTestId } = await render(<K4 />, mode, false);
    await findByTestId('entries-empty');
    expect(queryByTestId('pending-banner')).toBeNull();
  });

  it('k24 SMS section links to the same list', async () => {
    const { findByTestId, getByTestId } = await render(<K24_Settings />, mode);
    fireEvent.press(await findByTestId('settings-sms-pending'));
    expect(await findByTestId('pending-sheet')).toBeTruthy();
    expect(getByTestId('pending-existing-sms:abc:2026-10-24')).toBeTruthy();
  });
});
