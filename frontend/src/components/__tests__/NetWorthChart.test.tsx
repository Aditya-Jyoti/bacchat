import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { netWorthSeries } from '../../data';
import { renderWithTheme } from '../../testUtils';
import { NetWorthChart } from '../NetWorthChart';

const labels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const fmt = (v: number) => `${v.toFixed(1)}L`;

function setup(mode: 'light' | 'dark') {
  const utils = renderWithTheme(<NetWorthChart values={netWorthSeries} labels={labels} formatValue={fmt} />, mode);
  fireEvent(utils.getByTestId('networth-chart'), 'layout', { nativeEvent: { layout: { width: 300, height: 76 } } });
  return utils;
}

describe.each(['light', 'dark'] as const)('NetWorthChart (%s)', (mode) => {
  it('has an accessibility summary and the end dot', () => {
    const { getByLabelText, getByTestId } = setup(mode);
    expect(getByLabelText('Net worth chart, Nov to Oct. From 14.6L to 18.2L.')).toBeTruthy();
    expect(getByTestId('networth-end-dot')).toBeTruthy();
  });

  it('scrubs: shows a tooltip for the touched point and hides on release', () => {
    const { getByTestId, queryByTestId, getByText } = setup(mode);
    const chart = getByTestId('networth-chart');
    fireEvent(chart, 'touchStart', { nativeEvent: { locationX: 0 } });
    expect(getByText('14.6L')).toBeTruthy();
    expect(getByText('Nov')).toBeTruthy();
    fireEvent(chart, 'touchMove', { nativeEvent: { locationX: 300 } });
    expect(getByText('18.2L')).toBeTruthy();
    expect(queryByTestId('networth-end-dot')).toBeNull();
    fireEvent(chart, 'touchEnd', { nativeEvent: { locationX: 300 } });
    expect(queryByTestId('networth-tooltip')).toBeNull();
    expect(getByTestId('networth-end-dot')).toBeTruthy();
  });
});
