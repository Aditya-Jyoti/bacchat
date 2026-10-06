import { merchants } from '../../../data';

export type Payee = { name: string; icon: string; category: string; times: number };

/** Payees the user has paid before, with their usual category (history). */
export const PAYEES: readonly Payee[] = [
  { name: 'Third Wave Coffee', icon: 'local_cafe', category: 'Tea & coffee', times: 6 },
  { name: 'Third Wave, Indiranagar', icon: 'local_cafe', category: 'Tea & coffee', times: 1 },
  { name: 'Chai Point', icon: 'local_cafe', category: 'Tea & coffee', times: 4 },
  ...merchants.map((m) => ({
    name: m.name,
    icon: m.icon,
    category: m.name === 'Swiggy' ? 'Eating out' : m.name === 'Namma Metro' ? 'Transport' : m.name === 'Amazon' ? 'Shopping' : 'Groceries',
    times: m.times,
  })),
  { name: 'Blinkit', icon: 'shopping_basket', category: 'Groceries', times: 3 },
  { name: 'Medplus', icon: 'medication', category: 'Medicines', times: 2 },
  { name: 'Ramesh Fruits', icon: 'nutrition', category: 'Fruit & veg', times: 5 },
];

export function timesText(n: number): string {
  return n === 1 ? 'once' : `${n} times`;
}

/** Up to `limit` payees whose name contains the query (prefix matches first). */
export function suggest(query: string, limit = 3): Payee[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = PAYEES.filter((p) => p.name.toLowerCase().startsWith(q));
  const has = PAYEES.filter((p) => !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q));
  return [...starts, ...has].slice(0, limit);
}
