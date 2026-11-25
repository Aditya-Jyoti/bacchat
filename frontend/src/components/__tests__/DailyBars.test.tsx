import React from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { DailyBars, niceMax } from '../DailyBars';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

const VALUES = [98000, 142000, 64000, 231500, 76000, 296400]; // paise
const R = '\u20B9';

function setup(mode: 'light' | 'dark', over: Partial<React.ComponentProps<typeof DailyBars>> = {}) {
  const onSelect = jest.fn();
  const onTooltipPress = jest.fn();
  const utils = renderWithTheme(
    <DailyBars
      values={VALUES}
      daysInMonth={9}
      todayIndex={5}
      selectedIndex={1}
      onSelect={onSelect}
      onTooltipPress={onTooltipPress}
      tooltip={<Text>{`Total ${R}1,420`}</Text>}
      futureLabel="3 days to go"
      axisLabels={['1 Oct', 'today', '9']}
      summary="Daily spend summary"
      {...over}
    />,
    mode,
  );
  fireEvent(utils.getByTestId('daily-bars'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 260 } } });
  return { ...utils, onSelect, onTooltipPress };
}

describe.each(['light', 'dark'] as const)('DailyBars (%s)', (mode) => {
  const c = khataPalette(45, mode);
  const fill = (utils: ReturnType<typeof setup>, i: number) => flat(utils.getByTestId(`daily-bar-fill-${i}`).props.style).backgroundColor;

  it('picks a day by touching or dragging along the strip under the bars', () => {
    const u = setup(mode);
    const strip = u.getByTestId('daily-scrub');
    expect(strip.props.onResponderTerminationRequest()).toBe(false);
    // Bars area is 300 - 34 = 266 wide: 9 units (6 days + a 3-day future block) and 6 gaps of 3,
    // so a day is 27.6 wide and starts every 30.6.
    fireEvent(strip, 'responderGrant', { nativeEvent: { locationX: 2 } });
    expect(u.onSelect).toHaveBeenLastCalledWith(0);
    fireEvent(strip, 'responderMove', { nativeEvent: { locationX: 30.6 * 4 + 5 } });
    expect(u.onSelect).toHaveBeenLastCalledWith(4);
    // Past the last day (into the future block) it stays on the last day.
    fireEvent(strip, 'responderMove', { nativeEvent: { locationX: 260 } });
    expect(u.onSelect).toHaveBeenLastCalledWith(5);
  });

  it('colours every spend bar primary and steps the others back when one is picked', () => {
    const u = setup(mode);
    for (const i of [0, 1, 2, 3, 5]) expect(fill(u, i)).toBe(c.primary);
    const opacity = (i: number) => flat(u.getByTestId(`daily-bar-fill-${i}`).parent!.parent!.props.style).opacity;
    expect(opacity(1)).toBe(1);
    expect(opacity(0)).toBe(0.45);
    expect(opacity(5)).toBe(0.45);
    const none = setup(mode, { selectedIndex: null });
    expect(flat(none.getAllByTestId('daily-bar-fill-0')[0].parent!.parent!.props.style).opacity).toBe(1);
  });

  it('draws a money-in bar beside the spend on days with income, and a legend only then', () => {
    const plain = setup(mode, { legend: { spent: 'Spent', income: 'Got' } });
    expect(plain.queryByTestId('daily-legend')).toBeNull();
    expect(plain.queryByTestId('daily-income-fill-0')).toBeNull();
    const u = setup(mode, { incomeValues: [0, 0, 250000, 0, 0, 0], legend: { spent: 'Spent', income: 'Got' } });
    expect(u.queryByTestId('daily-income-fill-0')).toBeNull();
    const inc = u.getByTestId('daily-income-fill-2');
    expect(flat(inc.props.style).backgroundColor).toBe(c.moneyIn);
    expect(parseFloat(flat(inc.props.style).height as string)).toBeCloseTo((250000 / 500000) * 100, 1);
    expect(u.getByTestId('daily-legend')).toBeTruthy();
    expect(u.getByText('Spent')).toBeTruthy();
    expect(u.getByText('Got')).toBeTruthy();
    // Income without legend words draws no legend.
    expect(setup(mode, { incomeValues: [0, 0, 250000, 0, 0, 0] }).queryByTestId('daily-legend')).toBeNull();
  });

  it('draws the dashed future block with its label and the axis captions', () => {
    const u = setup(mode);
    const future = flat(u.getByTestId('daily-future').props.style);
    expect(future.borderStyle).toBe('dashed');
    expect(future.flex).toBe(3);
    // Three days is too narrow for the caption on one line, so it is left out.
    expect(u.queryByText('3 days to go')).toBeNull();
    // "today" sits under today's bar (index 5 of 9 days on a 300 wide chart with a 34 wide scale).
    expect(flat(u.getByText('today').props.style).left).toBeCloseTo(((300 - 34) / 9) * 5.5 - 28, 3);
    const wide = setup(mode, { daysInMonth: 30, futureLabel: '24 days to go' });
    expect(wide.getByText('24 days to go')).toBeTruthy();
    // Near the start or the end of the month the caption would run into "1 Oct" or the last day.
    expect(setup(mode, { todayIndex: 1 }).queryByText('today')).toBeNull();
  });

  it('scales bar heights against the top of the amount scale', () => {
    const u = setup(mode);
    // The scale tops out at 5k, so heights are shares of 5,000 rupees.
    expect(parseFloat(flat(u.getByTestId('daily-bar-fill-5').props.style).height as string)).toBeCloseTo((296400 / 500000) * 100, 1);
    const h = flat(u.getByTestId('daily-bar-fill-0').props.style).height as string;
    expect(parseFloat(h)).toBeCloseTo((98000 / 500000) * 100, 1);
  });

  it('selects on press, hover and focus, and each bar is a focusable button', () => {
    const u = setup(mode);
    const bar = u.getByTestId('daily-bar-2');
    expect(bar.props.focusable).toBe(true);
    expect(bar.props.accessibilityRole).toBe('button');
    fireEvent.press(bar);
    fireEvent(bar, 'hoverIn');
    fireEvent(bar, 'focus');
    expect(u.onSelect).toHaveBeenCalledTimes(3);
    expect(u.onSelect).toHaveBeenCalledWith(2);
  });

  it('shows the tooltip for the selected bar, inside the chart, and it is pressable', () => {
    const u = setup(mode);
    expect(u.getByText(`Total ${R}1,420`)).toBeTruthy();
    const pos = flat(u.getByTestId('daily-tooltip').props.style);
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect((pos.left as number) + (pos.width as number)).toBeLessThanOrEqual(300);
    fireEvent.press(u.getByTestId('daily-tooltip'));
    expect(u.onTooltipPress).toHaveBeenCalled();
  });

  it('clamps the tooltip at the right edge and hides it with no selection', () => {
    const right = setup(mode, { selectedIndex: 5 });
    const pos = flat(right.getByTestId('daily-tooltip').props.style);
    expect((pos.left as number) + (pos.width as number)).toBeLessThanOrEqual(300);
    const none = setup(mode, { selectedIndex: null });
    expect(none.queryByTestId('daily-tooltip')).toBeNull();
  });

  it('draws an amount scale rounded up from the tallest day', () => {
    const u = setup(mode);
    // Tallest day is 2,964 rupees, so the scale tops out at 5k with 2.5k half way.
    expect(u.getByText('5k')).toBeTruthy();
    expect(u.getByText('2.5k')).toBeTruthy();
    expect(u.getByText('0')).toBeTruthy();
    expect(niceMax(296400)).toBe(500000);
    expect(niceMax(120000)).toBe(200000);
    expect(niceMax(0)).toBe(100);
  });

  it('exposes accessibility summaries for the chart and every bar', () => {
    const u = setup(mode, { labelFor: (i) => `Day ${i + 1} label` });
    expect(u.getByLabelText('Daily spend summary')).toBeTruthy();
    expect(u.getByTestId('daily-bar-4').props.accessibilityLabel).toBe('Day 5 label');
    const d = setup(mode, { labelFor: undefined });
    expect(d.getAllByTestId('daily-bar-0')[0].props.accessibilityLabel).toBe(`Day 1: ${R}980`);
  });
});
