/** Paste a message (k4 empty state) and the Read bank SMS row (k24), on an empty local database. */
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { usePreferences } from '../../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import K24_Settings from '../../you/K24_Settings';
import K4 from '../K4_MoneyEntries';
import { renderScreen } from './helpers';

const NOW = new Date(2026, 9, 24, 20, 30).getTime();
const BODY = 'Dear UPI user A/C X1234 debited by 150.0 on date 24Oct26 trf to RAMESH FRUITS Refno 429812345678 If not u? call 1800111109. -SBI';

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ smsIngestEnabled: false, smsBackfilledAt: null });
});

const render = (ui: React.ReactElement, mode: 'light' | 'dark') => {
  const db = createMemoryDb();
  return { db, ...renderScreen(ui, mode, undefined, undefined, { db, servicesOptions: { seed: false, now: () => NOW } }) };
};

describe.each(['light', 'dark'] as const)('paste a message (%s)', (mode) => {
  it('k4 empty state: pastes a bank SMS and adds a To review entry', async () => {
    const { db, findByTestId, getByTestId, findByText } = render(<K4 />, mode);
    fireEvent.press(await findByTestId('entries-paste-open'));
    const add = getByTestId('entries-paste-add');
    expect(add.props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(getByTestId('entries-paste-input'), BODY);
    fireEvent.press(getByTestId('entries-paste-add'));
    await findByText(/Added Ramesh Fruits/);
    const rows = await db.entries.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'toReview', amountPaise: 15000 });
  });

  it('says so when no amount can be found', async () => {
    const { findByTestId, getByTestId, findByText } = render(<K4 />, mode);
    fireEvent.press(await findByTestId('entries-paste-open'));
    fireEvent.changeText(getByTestId('entries-paste-input'), 'see you at lunch');
    fireEvent.press(getByTestId('entries-paste-add'));
    await findByText(/Could not find an amount/);
  });

  it('k24: the SMS switch explains that reading is unavailable here and stays off', async () => {
    const { getByTestId, findByTestId } = render(<K24_Settings />, mode);
    fireEvent(getByTestId('settings-switch-sms'), 'valueChange', true);
    await findByTestId('settings-sms-note');
    await waitFor(() => expect(usePreferences.getState().smsIngestEnabled).toBe(false));
  });
});
