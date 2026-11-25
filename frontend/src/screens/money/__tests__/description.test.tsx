/** Spend descriptions: shown under the row subtitle in k4 and added or edited from the k27 menu. */
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { EntryRow } from '../parts/EntryRow';
import { rowFor, EMPTY_LOOKUPS } from '../parts/live';
import K27 from '../K27_LongPressMenu';
import { fixtureDb, NOW } from './fixture';
import { mockNav, renderLive, renderScreen } from './helpers';

describe.each(['light', 'dark'] as const)('descriptions (%s)', (mode) => {
  it('shows the note as one extra line and in the accessibility label', () => {
    const row = { name: 'Blinkit', icon: 'help', sub: 'Groceries · UPI', amountPaise: 100, note: 'Dinner for Ria' };
    const { getByTestId, unmount } = renderScreen(<EntryRow {...row} testID="r" />, mode);
    expect(getByTestId('entry-note-Blinkit').props.children).toBe('Dinner for Ria');
    expect(getByTestId('entry-note-Blinkit').props.numberOfLines).toBe(1);
    expect(getByTestId('r').props.accessibilityLabel).toContain('Dinner for Ria');
    unmount();
    const bare = renderScreen(<EntryRow {...row} note={null} testID="r" />, mode);
    expect(bare.queryByTestId('entry-note-Blinkit')).toBeNull();
  });

  it('rowFor passes a trimmed note through and drops blank ones', () => {
    const base = { id: 'a', amountPaise: 100, direction: 'out' as const, at: 0, merchant: 'X', categoryId: null, accountId: null, method: 'upi' as const, sources: [], status: 'confirmed' as const, aiAdded: false, updatedAt: 0 };
    expect(rowFor({ ...base, note: ' hi ' }, EMPTY_LOOKUPS).note).toBe('hi');
    expect(rowFor({ ...base, note: '  ' }, EMPTY_LOOKUPS).note).toBeNull();
  });

  it('adds a description from the long-press menu', async () => {
    const { findByTestId, getByTestId, getByText, services, nav } = await renderLive(<K27 />, mode, { id: 'e-blinkit' });
    expect(await findByTestId('menu-describe')).toBeTruthy();
    expect(getByText('Add description')).toBeTruthy();
    fireEvent.press(getByTestId('menu-describe'));
    fireEvent.changeText(await findByTestId('description-input'), '  Weekly veg  ');
    fireEvent.press(getByTestId('description-save'));
    await waitFor(async () => expect((await services.db.entries.get('e-blinkit'))?.note).toBe('Weekly veg'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('edits an existing description and clears it when emptied', async () => {
    const db = await fixtureDb();
    const e = (await db.entries.get('e-blinkit'))!;
    await db.entries.put({ ...e, note: 'Old note' });
    const { findByTestId, getByTestId, getByText, services } = renderScreen(<K27 />, mode, { id: 'e-blinkit' }, mockNav(), { db, servicesOptions: { seed: false, now: () => NOW } });
    expect(await findByTestId('menu-describe')).toBeTruthy();
    expect(getByText('Edit description')).toBeTruthy();
    fireEvent.press(getByTestId('menu-describe'));
    expect((await findByTestId('description-input')).props.value).toBe('Old note');
    fireEvent.changeText(getByTestId('description-input'), 'New note');
    fireEvent.press(getByTestId('description-save'));
    await waitFor(async () => expect((await services.db.entries.get('e-blinkit'))?.note).toBe('New note'));
  });

  it('Cancel leaves the note alone and an empty save clears it', async () => {
    const db = await fixtureDb();
    const e = (await db.entries.get('e-blinkit'))!;
    await db.entries.put({ ...e, note: 'Keep' });
    const { findByTestId, getByTestId, queryByTestId, services } = renderScreen(<K27 />, mode, { id: 'e-blinkit' }, mockNav(), { db, servicesOptions: { seed: false, now: () => NOW } });
    fireEvent.press(await findByTestId('menu-describe'));
    fireEvent.changeText(await findByTestId('description-input'), 'Changed');
    fireEvent.press(getByTestId('description-cancel'));
    await waitFor(() => expect(queryByTestId('description-input')).toBeNull());
    expect((await services.db.entries.get('e-blinkit'))?.note).toBe('Keep');
    fireEvent.press(getByTestId('menu-describe'));
    fireEvent.changeText(await findByTestId('description-input'), '   ');
    fireEvent.press(getByTestId('description-save'));
    await waitFor(async () => expect((await services.db.entries.get('e-blinkit'))?.note).toBeNull());
  });
});
