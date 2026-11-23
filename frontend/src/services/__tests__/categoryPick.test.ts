/** @jest-environment node */
import type { Category, Entry } from '../../data/db/models';
import { cleanAmountInput } from '../../screens/money/K5_AddEntry';
import { rankCategories } from '../categoryPick';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 24, 12).getTime();
const cat = (id: string, hidden = false): Category => ({ id, name: id, icon: 'category', hidden, updatedAt: 0 }) as Category;
const used = (categoryId: string, daysAgo: number, direction: Entry['direction'] = 'out'): Entry =>
  ({ id: `${categoryId}-${daysAgo}`, categoryId, direction, at: NOW - daysAgo * DAY, deletedAt: null }) as Entry;

describe('rankCategories', () => {
  const cats = [cat('bills'), cat('food'), cat('travel'), cat('fun'), cat('hidden', true)];

  it('puts the most used recent categories first, then list order, without hidden ones', () => {
    const history = [used('travel', 1), used('food', 2), used('food', 3), used('fun', 90), used('fun', 91), used('fun', 92), used('bills', 1, 'in')];
    const r = rankCategories({ categoryId: null, direction: 'out', at: NOW }, cats, history).map((c) => c.id);
    expect(r).toEqual(['food', 'travel', 'bills', 'fun']);
  });

  it("puts the entry's own guessed category first", () => {
    const r = rankCategories({ categoryId: 'fun', direction: 'out', at: NOW }, cats, [used('food', 1)]).map((c) => c.id);
    expect(r.slice(0, 2)).toEqual(['fun', 'food']);
  });
});

describe('cleanAmountInput (k5 amount from the phone keyboard)', () => {
  it.each([
    ['1,24,9.505', '1249.50'],
    ['007', '7'],
    ['.5', '0.5'],
    ['12..3', '12.3'],
    ['abc', ''],
    ['', ''],
    ['1234567890123', '123456789'],
  ])('%s -> %s', (input, out) => {
    expect(cleanAmountInput(input)).toBe(out);
  });
});
