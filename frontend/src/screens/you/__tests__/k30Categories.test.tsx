/** k30 Categories: list with use counts, add, rename and re-icon, hide (kept on entries, left out of pickers). */
import { fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { renderWithTheme } from '../../../testUtils';
import { CategoryChoices } from '../../money/parts/CategoryChoices';
import K23_You from '../K23_You';
import K30_Categories from '../K30_Categories';

async function notebook() {
  const db = createMemoryDb();
  await db.categories.putMany([
    { id: 'cat-food', name: 'Food', icon: 'restaurant' },
    { id: 'cat-fuel', name: 'Fuel', icon: 'local_gas_station' },
  ]);
  const base = { direction: 'out' as const, aiAdded: false, accountId: null, method: 'upi' as const, sources: [], status: 'confirmed' as const };
  await db.entries.putMany([
    { ...base, id: 'e1', amountPaise: 10000, at: 1, merchant: 'Cafe', categoryId: 'cat-food' },
    { ...base, id: 'e2', amountPaise: 20000, at: 2, merchant: 'Diner', categoryId: 'cat-food' },
    { ...base, id: 'e3', amountPaise: 30000, at: 3, merchant: 'Pump', categoryId: 'cat-fuel' },
  ]);
  return db;
}

describe.each(['light', 'dark'] as const)('k30 Categories (%s)', (mode) => {
  it('lists categories with how many entries use each', async () => {
    const db = await notebook();
    const { findByTestId, getByLabelText, getByTestId } = renderWithTheme(<K30_Categories />, mode, { servicesOptions: { seed: false, db } });
    expect(getByTestId('screen-k30')).toBeTruthy();
    await findByTestId('category-row-Food');
    expect(getByLabelText('Food, 2 entries')).toBeTruthy();
    expect(getByLabelText('Fuel, 1 entry')).toBeTruthy();
  });

  it('adds a category with a name and icon, and refuses a duplicate name', async () => {
    const db = await notebook();
    const { findByTestId, getByTestId } = renderWithTheme(<K30_Categories />, mode, { servicesOptions: { seed: false, db } });
    await findByTestId('category-row-Food');
    fireEvent.press(getByTestId('category-add'));
    expect(getByTestId('category-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('category-name-input'), 'food');
    expect(getByTestId('category-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('category-name-input'), 'Pooja');
    fireEvent.press(getByTestId('icon-redeem'));
    fireEvent.press(getByTestId('category-save'));
    await findByTestId('category-row-Pooja');
    const made = (await db.categories.list()).find((c) => c.name === 'Pooja');
    expect(made).toMatchObject({ icon: 'redeem', hidden: false });
  });

  it('renames a category and hides it; the entries keep it and pickers leave it out', async () => {
    const db = await notebook();
    const { findByTestId, getByTestId, findByText } = renderWithTheme(<K30_Categories />, mode, { servicesOptions: { seed: false, db } });
    fireEvent.press(await findByTestId('category-row-Fuel'));
    fireEvent.changeText(getByTestId('category-name-input'), 'Petrol');
    fireEvent(getByTestId('category-hidden'), 'valueChange', true);
    fireEvent.press(getByTestId('category-save'));
    expect(await findByText('Hidden')).toBeTruthy();
    await findByTestId('category-row-Petrol');
    await waitFor(async () => expect(await db.categories.get('cat-fuel')).toMatchObject({ name: 'Petrol', hidden: true }));
    expect((await db.entries.get('e3'))?.categoryId).toBe('cat-fuel');

    const cats = await db.categories.list();
    const picker = renderWithTheme(<CategoryChoices categories={cats} onPick={() => undefined} />, mode);
    expect(picker.queryByTestId('choice-Petrol')).toBeNull();
    expect(picker.getByTestId('choice-Food')).toBeTruthy();
  });
});

it('removes a category after a confirm; its entries keep their amounts and ask for a category again', async () => {
  const db = await notebook();
  const { findByTestId, getByTestId } = renderWithTheme(<K30_Categories />, 'light', { servicesOptions: { seed: false, db } });
  fireEvent.press(await findByTestId('category-row-Fuel'));
  fireEvent.press(getByTestId('category-remove'));
  fireEvent.press(getByTestId('category-remove-confirm'));
  await waitFor(async () => expect(await db.categories.get('cat-fuel')).toBeNull());
  expect(await db.entries.get('e3')).toMatchObject({ categoryId: null, amountPaise: 30000 });
});

it('the Categories row in You opens k30 and counts visible categories', async () => {
  const db = await notebook();
  await db.categories.put({ id: 'cat-old', name: 'Old', icon: 'category', hidden: true });
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
  const { findByLabelText, getByTestId } = renderWithTheme(
    <NavigationContext.Provider value={navigation as never}>
      <K23_You />
    </NavigationContext.Provider>,
    'light',
    { servicesOptions: { seed: false, db } },
  );
  expect(await findByLabelText('Categories, 2 categories')).toBeTruthy();
  fireEvent.press(getByTestId('you-row-categories'));
  expect(navigation.navigate).toHaveBeenCalledWith('you/categories');
});

it('About shows the version and is not a button that does nothing', async () => {
  const { findByTestId, getByText } = renderWithTheme(<K23_You />, 'light', { servicesOptions: { seed: false } });
  const row = await findByTestId('you-row-about');
  expect(row.props.accessibilityRole).not.toBe('button');
  expect(getByText(/^Version .* open source, GPL-3.0$/)).toBeTruthy();

});

describe.each(['light', 'dark'] as const)('k30 budget links (%s)', (mode) => {
  it('links a category to a named budget so its spends count there', async () => {
    const db = await notebook();
    await db.budgets.put({ id: 'b-food', categoryId: '', name: 'Monthly food', icon: 'restaurant', monthlyPaise: 500000 });
    const r = renderWithTheme(<K30_Categories />, mode, { servicesOptions: { seed: false, db } });
    fireEvent.press(await r.findByTestId('category-row-Fuel'));
    fireEvent.press(await r.findByTestId('category-budget'));
    fireEvent.press(r.getByText('Monthly food'));
    fireEvent.press(r.getByTestId('category-save'));
    await waitFor(async () => expect((await db.categories.get('cat-fuel'))?.budgetId).toBe('b-food'));
    expect(await r.findByLabelText('Fuel, 1 entry \u00B7 counts toward Monthly food')).toBeTruthy();
  });

  it('says where to add a budget when there are none to link', async () => {
    const db = await notebook();
    const r = renderWithTheme(<K30_Categories />, mode, { servicesOptions: { seed: false, db } });
    fireEvent.press(await r.findByTestId('category-row-Fuel'));
    expect(r.getByTestId('category-budget-none')).toBeTruthy();
  });
});
