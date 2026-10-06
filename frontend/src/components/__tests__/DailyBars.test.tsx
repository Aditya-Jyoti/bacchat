import React from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { DailyBars } from '../DailyBars';

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

  it('colours bars: selected primary, today chart2, over 2000 chart3, others surfaceContainerHigh', () => {
    const u = setup(mode);
    expect(fill(u, 1)).toBe(c.primary);
    expect(fill(u, 5)).toBe(c.chart2);
    expect(fill(u, 3)).toBe(c.chart3);
    expect(fill(u, 0)).toBe(c.surfaceContainerHigh);
    expect(fill(u, 2)).toBe(c.surfaceContainerHigh);
  });

  it('draws the dashed future block with its label and the axis captions', () => {
    const u = setup(mode);
    const future = flat(u.getByTestId('daily-future').props.style);
    expect(future.borderStyle).toBe('dashed');
    expect(future.flex).toBe(3);
    expect(u.getByText('3 days to go')).toBeTruthy();
    expect(u.getByText('today')).toBeTruthy();
  });

  it('scales bar heights against the tallest day', () => {
    const u = setup(mode);
    expect(flat(u.getByTestId('daily-bar-fill-5').props.style).height).toBe('100%');
    const h = flat(u.getByTestId('daily-bar-fill-0').props.style).height as string;
    expect(parseFloat(h)).toBeCloseTo((98000 / 296400) * 100, 1);
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

  it('exposes accessibility summaries for the chart and every bar', () => {
    const u = setup(mode, { labelFor: (i) => `Day ${i + 1} label` });
    expect(u.getByLabelText('Daily spend summary')).toBeTruthy();
    expect(u.getByTestId('daily-bar-4').props.accessibilityLabel).toBe('Day 5 label');
    const d = setup(mode, { labelFor: undefined });
    expect(d.getAllByTestId('daily-bar-0')[0].props.accessibilityLabel).toBe(`Day 1: ${R}980`);
  });
});
