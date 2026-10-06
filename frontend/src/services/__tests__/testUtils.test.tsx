import React from 'react';
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';

import { createMemoryDb } from '../../data/db';
import { renderWithTheme } from '../../testUtils';
import { useAccounts, useServices } from '..';

function Names(): React.JSX.Element {
  const { data } = useAccounts();
  return <Text testID="names">{(data ?? []).map((a) => a.name).join(',')}</Text>;
}

describe('renderWithTheme services', () => {
  it('renders children synchronously and exposes services', () => {
    function Probe() {
      useServices();
      return <Text>hello</Text>;
    }
    const r = renderWithTheme(<Probe />, 'dark');
    expect(r.getByText('hello')).toBeTruthy();
    expect(r.services.db.kind).toBe('memory');
  });

  it('seeds the sample on first query by default', async () => {
    const r = renderWithTheme(<Names />);
    await waitFor(() => expect(r.getByTestId('names').props.children).toContain('HDFC Savings'));
  });

  it('accepts a custom db without seeding it when seed is off', async () => {
    const db = createMemoryDb();
    await db.accounts.put({ id: 'x', name: 'Only me', kind: 'cash', balancePaise: 1, icon: 'payments' });
    const r = renderWithTheme(<Names />, 'light', { db, servicesOptions: { seed: false } });
    await waitFor(() => expect(r.getByTestId('names').props.children).toBe('Only me'));
  });
});
