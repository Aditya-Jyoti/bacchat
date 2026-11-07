/** Accounts can be edited and deleted; investments carry an optional next payment date. */
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { accountsWithBalances, upcoming } from '../../../data/db';
import { createTestServices } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K10_Accounts from '../K10_Accounts';
import K11_AddAccount from '../K11_AddAccount';
import { deleteAccount, updateAccount } from '../accountWrites';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn() });

function editScreen(services: ReturnType<typeof createTestServices>, id: string, navigation = nav()) {
  return {
    navigation,
    ...renderWithTheme(
      <NavigationContext.Provider value={navigation as never}>
        <NavigationRouteContext.Provider value={{ key: 'k11', name: 'you/accounts/add', params: { id } } as never}>
          <K11_AddAccount />
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>,
      'light',
      { services },
    ),
  };
}

it('tapping an account in Accounts opens it to edit', async () => {
  const navigation = nav();
  const r = renderWithTheme(
    <NavigationContext.Provider value={navigation as never}>
      <K10_Accounts />
    </NavigationContext.Provider>,
    'light',
  );
  fireEvent.press(await r.findByTestId('account-HDFC Savings'));
  expect(navigation.navigate).toHaveBeenCalledWith('you/accounts/add', { id: 'acc-hdfc' });
});

it('edit fills the form, saves a new name and balance, and keeps entries', async () => {
  const services = createTestServices({ seed: false });
  await services.db.accounts.put({ id: 'acc-s', name: 'Slice', kind: 'bank', balancePaise: 500000, openingBalancePaise: 500000, icon: 'account_balance' });
  await services.db.entries.put({ id: 'e1', amountPaise: 20000, direction: 'out', at: 1, merchant: 'Chai', categoryId: null, accountId: 'acc-s', method: 'bank', sources: [], status: 'confirmed', aiAdded: false });
  const r = editScreen(services, 'acc-s');
  await waitFor(() => expect(r.getByTestId('acct-name-input').props.value).toBe('Slice'));
  expect(r.getByText('Edit account')).toBeTruthy();
  expect(r.getByTestId('acct-owed-input').props.value).toBe('4,800');
  fireEvent.changeText(r.getByTestId('acct-name-input'), 'Slice savings');
  fireEvent.changeText(r.getByTestId('acct-owed-input'), '10000');
  fireEvent.press(r.getByTestId('add-account-submit'));
  await waitFor(() => expect(r.navigation.goBack).toHaveBeenCalled());
  const acc = (await accountsWithBalances(services.db)).find((a) => a.id === 'acc-s');
  expect(acc).toMatchObject({ name: 'Slice savings', balancePaise: 1000000 });
  expect(await services.db.entries.get('e1')).toBeTruthy();
});

it('an investment saves its next payment date, which shows in Coming up without an amount', async () => {
  const services = createTestServices({ seed: false });
  const now = services.now();
  const soon = new Date(now + 5 * 86400000);
  const key = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await services.db.accounts.put({ id: 'acc-nps', name: 'My NPS', kind: 'nps', balancePaise: 100000, icon: 'elderly' });
  await updateAccount(services.db, { id: 'acc-nps', name: 'My NPS', bank: '', amountPaise: 100000, limitPaise: 0, bill: '1st', due: '1st', nextPaymentDate: key });
  const items = await upcoming(services.db, now, 30);
  expect(items.find((i) => i.accountId === 'acc-nps')).toMatchObject({ noAmount: true, date: key, title: 'My NPS' });
});

it('delete asks first; entries stay without an account and goals kept in it are unlinked', async () => {
  const services = createTestServices({ seed: false });
  const db = services.db;
  await db.accounts.put({ id: 'acc-s', name: 'Slice', kind: 'bank', balancePaise: 500000, openingBalancePaise: 500000, icon: 'account_balance' });
  await db.entries.put({ id: 'e1', amountPaise: 20000, direction: 'out', at: 1, merchant: 'Chai', categoryId: null, accountId: 'acc-s', method: 'bank', sources: [], status: 'confirmed', aiAdded: false });
  await db.goals.put({ id: 'g1', name: 'Fun', icon: 'celebration', targetPaise: 0, targetDate: null, accountId: 'acc-s' });
  await db.allocations.put({ id: 'alloc-g1-acc-s', goalId: 'g1', accountId: 'acc-s', amountPaise: 100000 });
  const r = editScreen(services, 'acc-s');
  fireEvent.press(await r.findByTestId('account-delete'));
  fireEvent.press(r.getByTestId('account-delete-confirm'));
  await waitFor(async () => expect(await db.accounts.get('acc-s')).toBeNull());
  expect((await db.entries.get('e1'))?.accountId).toBeNull();
  expect((await db.goals.get('g1'))?.accountId).toBeNull();
  expect((await db.allocations.list()).map((a) => [a.goalId, a.accountId, a.amountPaise])).toEqual([['g1', 'unassigned', 100000]]);
  expect(deleteAccount).toBeDefined();
});
