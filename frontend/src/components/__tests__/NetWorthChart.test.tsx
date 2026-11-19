import React from 'react';
import { fireEvent, within } from '@testing-library/react-native';

import { netWorthSeries } from '../../data';
import { renderWithTheme } from '../../testUtils';
import { NetWorthChart } from '../NetWorthChart';

const labels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const fmt = (v: number) => `${v.toFixed(1)}L`;

function setup(mode: 'light' | 'dark', extra: Partial<React.ComponentProps<typeof NetWorthChart>> = {}) {
  const utils = renderWithTheme(<NetWorthChart values={netWorthSeries} labels={labels} formatValue={fmt} {...extra} />, mode);
  fireEvent(utils.getByTestId('networth-plot'), 'layout', { nativeEvent: { layout: { width: 300, height: 96 } } });
  return utils;
}

const touch = (x: number, pageOffset = 0) => ({ nativeEvent: { locationX: x, pageX: x + pageOffset } });

describe.each(['light', 'dark'] as const)('NetWorthChart (%s)', (mode) => {
  it('has an accessibility summary and the end dot', () => {
    const { getByLabelText, getByTestId } = setup(mode);
    expect(getByLabelText('Net worth chart, Nov to Oct. From 14.6L to 18.2L.')).toBeTruthy();
    expect(getByTestId('networth-end-dot')).toBeTruthy();
  });

  it('labels both axes: values on y (top, middle, bottom) and first, middle, last on x', () => {
    const { getByTestId } = setup(mode);
    const y = within(getByTestId('networth-y-axis'));
    const max = Math.max(...netWorthSeries);
    const min = Math.min(...netWorthSeries);
    expect(y.getByText(fmt(max))).toBeTruthy();
    expect(y.getByText(fmt(min))).toBeTruthy();
    expect(y.getByText(fmt((max + min) / 2))).toBeTruthy();
    const x = within(getByTestId('networth-x-axis'));
    expect(x.getByText('Nov')).toBeTruthy();
    expect(x.getByText('Apr')).toBeTruthy();
    expect(x.getByText('Oct')).toBeTruthy();
  });

  it('scrubs: claims the touch, shows a tooltip for the touched point and hides on release', () => {
    const { getByTestId, queryByTestId } = setup(mode);
    const plot = getByTestId('networth-plot');
    expect(plot.props.onStartShouldSetResponder()).toBe(true);
    // A scroll cannot take the touch away mid-scrub.
    expect(plot.props.onResponderTerminationRequest()).toBe(false);
    fireEvent(plot, 'responderGrant', touch(0, 40));
    let tip = within(getByTestId('networth-tooltip'));
    expect(tip.getByText('14.6L')).toBeTruthy();
    expect(tip.getByText('Nov')).toBeTruthy();
    // Moves use page coordinates, so a child under the finger cannot make it jump.
    fireEvent(plot, 'responderMove', { nativeEvent: { locationX: 3, pageX: 340 } });
    tip = within(getByTestId('networth-tooltip'));
    expect(tip.getByText('18.2L')).toBeTruthy();
    expect(queryByTestId('networth-end-dot')).toBeNull();
    fireEvent(plot, 'responderRelease', touch(300));
    expect(queryByTestId('networth-tooltip')).toBeNull();
    expect(getByTestId('networth-end-dot')).toBeTruthy();
  });

  it('the tooltip can show the full amount while the axis stays compact', () => {
    const { getByTestId } = setup(mode, { formatTooltip: (v) => `full ${v.toFixed(2)}` });
    fireEvent(getByTestId('networth-plot'), 'responderGrant', touch(0));
    expect(within(getByTestId('networth-tooltip')).getByText(`full ${netWorthSeries[0].toFixed(2)}`)).toBeTruthy();
  });

  it('a scroll that does take over clears the tooltip', () => {
    const { getByTestId, queryByTestId } = setup(mode);
    const plot = getByTestId('networth-plot');
    fireEvent(plot, 'responderGrant', touch(150));
    expect(getByTestId('networth-tooltip')).toBeTruthy();
    fireEvent(plot, 'responderTerminate', touch(150));
    expect(queryByTestId('networth-tooltip')).toBeNull();
  });

  it('shows what changed since the point before when asked', () => {
    const { getByTestId } = setup(mode, { describeChange: (d) => `${d < 0 ? 'down' : 'up'} ${Math.abs(d).toFixed(1)}` });
    fireEvent(getByTestId('networth-plot'), 'responderGrant', touch(300));
    const i = netWorthSeries.length - 1;
    const d = netWorthSeries[i] - netWorthSeries[i - 1];
    expect(getByTestId('networth-tooltip-change').props.children).toBe(`${d < 0 ? 'down' : 'up'} ${Math.abs(d).toFixed(1)}`);
  });
});
