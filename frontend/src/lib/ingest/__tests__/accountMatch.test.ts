/** Which account a bank or card message is about, now that card digits are not stored. */
import type { Account } from '../../../data/db/models';
import { createMemoryDb } from '../../../data/db';
import { matchAccount, nameTokens } from '../accountMatch';
import { insertCandidate } from '../pipeline';
import { parseSms } from '../sms';

const acc = (id: string, name: string, kind: Account['kind']): Account => ({ id, name, kind, icon: 'x', balancePaise: 0, updatedAt: 0 });
const ACCOUNTS = [acc('slice-cc', 'Slice Credit', 'card'), acc('slice-sb', 'Slice Savings', 'bank'), acc('hdfc', 'HDFC Bank', 'bank'), acc('cash', 'Cash', 'cash')];

describe('matchAccount', () => {
  it('keeps the distinctive words of a name', () => {
    expect(nameTokens('Slice Credit')).toEqual(['slice']);
    expect(nameTokens('HDFC Savings account')).toEqual(['hdfc']);
  });

  it('"credit card" in a Slice message is the Slice card', () => {
    expect(matchAccount(ACCOUNTS, 'VM-SLICEIT Rs 450 spent on your slice credit card at Swiggy')).toEqual({ accountId: 'slice-cc', method: 'card' });
  });

  it('"from a/c" in a Slice message is the Slice savings account, not the card', () => {
    expect(matchAccount(ACCOUNTS, 'VM-SLICEIT Rs 450 debited from your slice A/c XX12 to Swiggy via UPI')).toEqual({ accountId: 'slice-sb', method: null });
  });

  it('a debit card spend is the bank, marked debit', () => {
    expect(matchAccount(ACCOUNTS, 'HDFC Bank: Rs 999 spent on Debit Card xx4021 at Amazon')).toEqual({ accountId: 'hdfc', method: 'debit' });
  });

  it('the sender id alone is enough (SLICEIT, HDFCBK)', () => {
    expect(matchAccount(ACCOUNTS, 'AD-HDFCBK Rs 200 debited from a/c **1234')).toEqual({ accountId: 'hdfc', method: null });
  });

  it('"credited to your a/c" is a bank account, not a credit card', () => {
    expect(matchAccount(ACCOUNTS, 'VM-SLICEIT Rs 85,000 credited to your slice a/c')?.accountId).toBe('slice-sb');
  });

  it('with only one card, a credit card message uses it even without its name', () => {
    expect(matchAccount([acc('c1', 'My card', 'card'), acc('b1', 'SBI', 'bank')], 'Rs 300 spent on your credit card at Zomato')?.accountId).toBe('c1');
  });

  it('no name and no single card: no guess', () => {
    expect(matchAccount(ACCOUNTS, 'Rs 300 debited from a/c XX99')).toBeNull();
    expect(matchAccount(ACCOUNTS, null)).toBeNull();
  });
});

it('an SMS entry for a Slice credit card spend raises that card dues, a Slice a/c spend lowers the savings', async () => {
  const db = createMemoryDb();
  await db.accounts.putMany(ACCOUNTS.map(({ updatedAt: _u, ...a }) => a));
  const cardText = 'Rs 450 spent on your slice credit card at Swiggy on 07-11-26';
  const card = parseSms(cardText, { receivedAt: Date.now() });
  expect(card).not.toBeNull();
  const e1 = await insertCandidate(db, { ...card!, issuerText: `VM-SLICEIT ${cardText}` });
  expect([e1.accountId, e1.method]).toEqual(['slice-cc', 'card']);
  const bankText = 'Rs 120 debited from your slice A/c XX12 to Chai Point via UPI';
  const bank = parseSms(bankText, { receivedAt: Date.now() });
  const e2 = await insertCandidate(db, { ...bank!, issuerText: `VM-SLICEIT ${bankText}` });
  expect(e2.accountId).toBe('slice-sb');
  expect(JSON.stringify(e2)).not.toContain('SLICEIT');
});
