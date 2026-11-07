/** The category picker: a search box with fuzzy matching, and Create when nothing matches. */
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { renderWithTheme } from '../../../testUtils';
import { CategoryChoices, fuzzyScore, SHOWN_BEFORE_SEARCH } from '../parts/CategoryChoices';

const CATS = ['Groceries', 'Eating out', 'Fuel', 'Rent', 'Pooja', 'Gifts', 'Movies', 'Books', 'Travel', 'Tea and coffee'].map((name, i) => ({ id: `c${i}`, name, icon: 'category' }));

describe('fuzzyScore', () => {
  it('ranks starts-with over contains over letters in order', () => {
    expect(fuzzyScore('Groceries', 'gro')).toBe(3);
    expect(fuzzyScore('Tea and coffee', 'coffee')).toBe(2);
    expect(fuzzyScore('Groceries', 'grcs')).toBe(1);
    expect(fuzzyScore('Fuel', 'xyz')).toBe(0);
  });
});

describe.each(['light', 'dark'] as const)('CategoryChoices (%s)', (mode) => {
  it('shows a few before typing, then fuzzy matches', () => {
    const onPick = jest.fn();
    const { getByTestId, queryByTestId, getAllByTestId } = renderWithTheme(<CategoryChoices categories={CATS} onPick={onPick} />, mode);
    expect(getAllByTestId(/^choice-(?!create)/)).toHaveLength(SHOWN_BEFORE_SEARCH);
    fireEvent.changeText(getByTestId('category-choices-search'), 'cofe');
    expect(getByTestId('choice-Tea and coffee')).toBeTruthy();
    expect(queryByTestId('choice-Fuel')).toBeNull();
    fireEvent.press(getByTestId('choice-Tea and coffee'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c9' }));
  });

  it('offers Create when nothing matches, and creating picks the new category', async () => {
    const onPick = jest.fn();
    const { getByTestId, services } = renderWithTheme(<CategoryChoices categories={CATS} onPick={onPick} />, mode, { servicesOptions: { seed: false } });
    fireEvent.changeText(getByTestId('category-choices-search'), 'Gym');
    fireEvent.press(getByTestId('choice-create'));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gym' })));
    expect((await services.db.categories.list()).some((c) => c.name === 'Gym')).toBe(true);
  });
});
