/**
 * A small deterministic database for the Money screen tests, so they do not depend on the
 * design seed (which changes). "Today" is Sat 24 Oct 2026, 9:30 pm.
 */
import { createMemoryDb, type BacchatDb, type Entry } from '../../../data/db';

export const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const at = (m: number, d: number, h = 12, min = 0): number => new Date(2026, m, d, h, min).getTime();

type Seed = Partial<Entry> & Pick<Entry, 'id' | 'amountPaise' | 'at' | 'merchant'>;
const base: Omit<Entry, 'id' | 'amountPaise' | 'at' | 'merchant' | 'updatedAt'> = {
  direction: 'out',
  note: null,
  categoryId: null,
  accountId: 'acc-hdfc',
  method: 'debit',
  upiId: null,
  sources: [{ kind: 'sms' }],
  status: 'confirmed',
  aiAdded: false,
};
const e = (s: Seed): Entry => ({ ...base, updatedAt: 0, ...s });

export async function fixtureDb(): Promise<BacchatDb> {
  const db = createMemoryDb();
  await db.accounts.putMany([
    { id: 'acc-hdfc', name: 'HDFC Savings', kind: 'bank', balancePaise: 5_00_000_00, icon: 'account_balance', last4: '4021' },
    { id: 'acc-icici', name: 'ICICI Amazon Pay', kind: 'card', balancePaise: 0, icon: 'credit_card' },
    { id: 'acc-cash', name: 'Cash wallet', kind: 'cash', balancePaise: 12_000_00, icon: 'payments' },
  ]);
  await db.upiIds.putMany([{ id: 'upi-okhdfc', handle: 'rahul@okhdfc', label: 'HDFC Savings', accountId: 'acc-hdfc' }]);
  await db.categories.putMany(
    [
      ['groceries', 'Groceries', 'shopping_basket'],
      ['medicines', 'Medicines', 'medication'],
      ['tea-coffee', 'Tea & coffee', 'local_cafe'],
      ['shopping', 'Shopping', 'checkroom'],
      ['eating-out', 'Eating out', 'restaurant'],
      ['fruit-veg', 'Fruit & veg', 'nutrition'],
      ['bike-taxi', 'Bike taxi', 'two_wheeler'],
      ['transport', 'Transport', 'train'],
      ['refund', 'Refund', 'undo'],
      ['entertainment', 'Entertainment', 'movie'],
      ['gifts', 'Gifts', 'redeem'],
      ['income', 'Income', 'payments'],
    ].map(([id, name, icon]) => ({ id, name, icon })),
  );
  const upi = { method: 'upi' as const, upiId: 'upi-okhdfc' };
  const shot = [{ kind: 'shot' as const }];
  await db.entries.putMany([
    e({ id: 'e-blinkit', amountPaise: 51800, at: at(9, 24, 20, 40), merchant: 'Blinkit', categoryId: 'groceries', sources: shot, ...upi }),
    e({ id: 'e-medplus', amountPaise: 34200, at: at(9, 24, 19, 55), merchant: 'Medplus', categoryId: 'medicines', sources: shot, ...upi }),
    e({ id: 'e-third', amountPaise: 28000, at: at(9, 24, 17, 30), merchant: 'Third Wave Coffee', categoryId: 'tea-coffee', sources: shot, ...upi }),
    e({ id: 'e-amazon', amountPaise: 124900, at: at(9, 24, 15, 12), merchant: 'Amazon', categoryId: 'shopping', accountId: 'acc-icici', method: 'card', sources: [{ kind: 'mail' }, { kind: 'shot', rawRef: 'resolved' }] }),
    e({ id: 'e-swiggy', amountPaise: 48600, at: at(9, 24, 13, 42), merchant: 'Swiggy', categoryId: 'eating-out', accountId: 'acc-icici', method: 'card', sources: [{ kind: 'sms' }, { kind: 'shot' }] }),
    e({ id: 'e-ramesh', amountPaise: 15000, at: at(9, 24, 12, 10), merchant: 'Ramesh Fruits', categoryId: 'fruit-veg', sources: shot, ...upi }),
    e({ id: 'e-rapido', amountPaise: 8900, at: at(9, 24, 11, 2), merchant: 'Rapido', categoryId: 'bike-taxi', sources: shot, ...upi }),
    e({ id: 'e-bigbasket', amountPaise: 231500, at: at(9, 23, 20, 30), merchant: 'BigBasket', categoryId: 'groceries', status: 'toReview', aiAdded: true }),
    e({ id: 'e-myntra-refund', amountPaise: 89900, at: at(9, 23, 11, 0), merchant: 'Myntra refund', categoryId: 'refund', direction: 'in', sources: [{ kind: 'mail' }], status: 'toReview', aiAdded: true }),
    e({ id: 'e-auto', amountPaise: 12000, at: at(9, 23, 10, 20), merchant: 'Auto ride', categoryId: 'transport', accountId: 'acc-cash', method: 'cash', sources: [{ kind: 'hand' }] }),
    e({ id: 'e-pvr', amountPaise: 128000, at: at(9, 17, 20), merchant: 'PVR Cinemas', categoryId: 'entertainment' }),
    e({ id: 'e-toit', amountPaise: 145000, at: at(9, 17, 21), merchant: 'Toit (dinner)', categoryId: 'eating-out' }),
    e({ id: 'e-small', amountPaise: 16000, at: at(9, 17, 12), merchant: 'Small payments', categoryId: 'eating-out' }),
    e({ id: 'e-swiggy-9', amountPaise: 88000, at: at(9, 9, 13), merchant: 'Swiggy', categoryId: 'eating-out' }),
    e({ id: 'e-swiggy-1', amountPaise: 98000, at: at(9, 1, 13), merchant: 'Swiggy', categoryId: 'eating-out' }),
    e({ id: 'e-salary', amountPaise: 126000_00, at: at(9, 1, 9), merchant: 'Salary', categoryId: 'income', direction: 'in', method: 'bank', sources: [{ kind: 'hand' }] }),
    e({ id: 'e-sept-eat', amountPaise: 400000, at: at(8, 15), merchant: 'Eating out (September)', categoryId: 'eating-out' }),
    e({ id: 'e-sept-groc', amountPaise: 300000, at: at(8, 16), merchant: 'Groceries (September)', categoryId: 'groceries' }),
  ]);
  for (const x of await db.entries.list()) {
    if (x.direction === 'out') await db.merchants.record(x.merchant, x.categoryId, x.amountPaise, x.at);
  }
  return db;
}
