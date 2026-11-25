/** k31 This spend: opened from a "From your messages" notification for one entry. */
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import K31 from '../K31_PickCategory';
import { mockNav, renderLive, R } from './helpers';

describe.each(['light', 'dark'] as const)('k31 This spend (%s)', (mode) => {
  it('shows the entry and every visible category, the current one marked', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    expect(r.getByTestId('screen-k31')).toBeTruthy();
    expect(r.getByText('This spend')).toBeTruthy();
    await r.findByTestId('pick-entry');
    expect(r.getByText('Category')).toBeTruthy();
    expect(r.getByText('Blinkit')).toBeTruthy();
    expect(r.getByTestId('pick-amount').props.children).toBe(`${R}518`);
    expect(r.getByTestId('pick-Groceries').props.accessibilityLabel).toBe('Groceries, chosen now');
    expect(r.getByTestId('pick-Transport')).toBeTruthy();
  });

  it('one tap files the entry, confirms it and goes back', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    fireEvent.press(await r.findByTestId('pick-Gifts'));
    await waitFor(async () => expect(await r.services.db.entries.get('e-blinkit')).toMatchObject({ categoryId: 'gifts', status: 'confirmed' }));
    await waitFor(() => expect(r.nav.goBack).toHaveBeenCalled());
  });

  it('saves the description when the field is left and confirms the entry', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    const field = await r.findByTestId('pick-note');
    fireEvent.changeText(field, '  Party snacks ');
    fireEvent(field, 'endEditing');
    await waitFor(async () => expect(await r.services.db.entries.get('e-blinkit')).toMatchObject({ note: 'Party snacks', status: 'confirmed' }));
  });

  it('a category pick after typing a description keeps both', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    fireEvent.changeText(await r.findByTestId('pick-note'), 'Birthday');
    fireEvent.press(r.getByTestId('pick-Gifts'));
    await waitFor(async () => expect(await r.services.db.entries.get('e-blinkit')).toMatchObject({ categoryId: 'gifts', note: 'Birthday' }));
  });

  it('Edit all details saves the description and opens k5 for the entry', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    fireEvent.changeText(await r.findByTestId('pick-note'), 'Late night');
    fireEvent.press(r.getByTestId('pick-edit-all'));
    expect(r.nav.navigate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'e-blinkit' }));
    await waitFor(async () => expect((await r.services.db.entries.get('e-blinkit'))?.note).toBe('Late night'));
  });

  it('search narrows the list and can create a new category', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'e-blinkit' });
    fireEvent.changeText(await r.findByTestId('pick-search'), 'trans');
    expect(r.queryByTestId('pick-Gifts')).toBeNull();
    expect(r.getByTestId('pick-Transport')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('pick-search'), 'Hostel');
    fireEvent.press(r.getByTestId('pick-create'));
    await waitFor(async () => {
      const e = await r.services.db.entries.get('e-blinkit');
      const c = e?.categoryId ? await r.services.db.categories.get(e.categoryId) : null;
      expect(c?.name).toBe('Hostel');
    });
  });

  it('says so calmly when the entry is gone, with a way to Entries', async () => {
    const r = await renderLive(<K31 />, mode, { entry: 'nope' }, mockNav(false));
    expect(await r.findByTestId('pick-gone')).toBeTruthy();
    fireEvent.press(r.getByTestId('pick-entries'));
    expect(r.nav.navigate).toHaveBeenCalled();
  });
});
