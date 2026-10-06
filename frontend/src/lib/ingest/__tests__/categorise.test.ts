import { categorise } from '../categorise';
import type { MerchantHistory } from '../../../data/db/models';
import { normalizeMerchant } from '../../reconciliation';

const h = (name: string, categoryId: string | null, count = 1): MerchantHistory => ({
  id: name,
  name,
  key: normalizeMerchant(name),
  categoryId,
  count,
  totalPaise: 0,
  lastAt: 0,
  updatedAt: 0,
});
const cats = [
  { id: 'eating-out', name: 'Eating out' },
  { id: 'groceries', name: 'Groceries' },
  { id: 'transport', name: 'Transport' },
];

describe('categorise', () => {
  const history = [h('Swiggy', 'eating-out', 9), h('BigBasket', 'groceries', 2), h('Untagged Shop', null, 4)];

  it('uses exact merchant history, more confident with more visits', () => {
    const a = categorise('swiggy', history, cats);
    expect(a).toMatchObject({ categoryId: 'eating-out', reason: 'history', needsPick: false });
    const b = categorise('BigBasket', history, cats);
    expect(a.confidence).toBeGreaterThan(b.confidence);
    expect(a.confidence).toBeLessThanOrEqual(0.95);
  });

  it('matches similar payees', () => {
    const r = categorise('Swiggy Instamart', history, cats);
    expect(r).toMatchObject({ categoryId: 'eating-out', reason: 'similar' });
    expect(r.confidence).toBeLessThan(0.7);
  });

  it('falls back to keywords only for categories the user has', () => {
    expect(categorise('Rapido', [], cats)).toMatchObject({ categoryId: 'transport', reason: 'keyword' });
    expect(categorise('Namma Metro', [], cats).categoryId).toBe('transport');
    // No shopping category exists: do not invent one.
    expect(categorise('Myntra', [], cats)).toMatchObject({ categoryId: null, needsPick: true });
  });

  it('asks to pick a category for unknown payees and missing names', () => {
    expect(categorise('Mohan S', history, cats)).toEqual({ categoryId: null, confidence: 0, reason: 'none', needsPick: true });
    expect(categorise(null, history, cats).needsPick).toBe(true);
    expect(categorise('  ', history, cats).needsPick).toBe(true);
  });

  it('ignores history rows with no category', () => {
    expect(categorise('Untagged Shop', history, cats).needsPick).toBe(true);
  });

  it('prefers history over keywords', () => {
    expect(categorise('Swiggy', [h('Swiggy', 'groceries', 1)], cats).categoryId).toBe('groceries');
  });
});
