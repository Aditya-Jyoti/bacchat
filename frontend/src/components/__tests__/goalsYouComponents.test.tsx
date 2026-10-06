import React from 'react';
import { processColor } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { AllocationSheet } from '../AllocationSheet';
import { AvatarStack } from '../AvatarStack';
import { FilterChip } from '../FilterChip';
import { NumberStepper } from '../NumberStepper';
import { OptionPicker } from '../OptionPicker';
import { OutlinedField } from '../OutlinedField';
import { OweBar } from '../OweBar';
import { PaceBar } from '../PaceBar';
import { PillButton } from '../PillButton';
import { SegmentedChoice } from '../SegmentedChoice';
import { StackScreen } from '../StackScreen';
import { TopBar, TopBarAction } from '../TopBar';
import { ValueSlider, snapValue } from '../ValueSlider';
import { BeachChairIllustration, JarFill } from '../illustrations';

const paint = (v: unknown): unknown => (v as { payload: unknown }).payload;

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('goals and you components (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('NumberStepper steps within bounds and exposes adjustable actions', () => {
    const onChange = jest.fn();
    const { getByTestId, getByRole } = renderWithTheme(<NumberStepper label="Months" value={2} min={1} max={3} onChange={onChange} />, mode);
    fireEvent.press(getByTestId('stepper-inc'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent.press(getByTestId('stepper-dec'));
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent(getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('NumberStepper disables at the limits', () => {
    const { getByTestId } = renderWithTheme(<NumberStepper label="Months" value={1} min={1} onChange={jest.fn()} format={(v) => `${v} mo`} />, mode);
    expect(getByTestId('stepper-dec').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('stepper-value').props.children).toBe('1 mo');
  });

  it('AvatarStack shows initials, +N overflow and a spoken summary', () => {
    const items = ['Asha', 'Bala', 'Chitra', 'Dev', 'Esha'].map((name) => ({ id: name, name }));
    const { getByText, getByTestId } = renderWithTheme(<AvatarStack items={items} max={3} />, mode);
    expect(getByText('A')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
    expect(getByTestId('avatar-stack').props.accessibilityLabel).toBe('Asha, Bala, Chitra and 2 more');
  });

  it('OweBar fills with chart3 and reads the caption', () => {
    const { getByTestId } = renderWithTheme(<OweBar fraction={0.07} caption={'7% of \u20B92,00,000 limit'} />, mode);
    const fill = flat(getByTestId('owe-bar-fill').props.style);
    expect(fill.backgroundColor).toBe(c.chart3);
    expect(fill.width).toBe('7%');
    expect(getByTestId('owe-bar').props.accessibilityValue.now).toBe(7);
  });

  it('PaceBar draws the today marker and takes a fill override', () => {
    const { getByTestId } = renderWithTheme(<PaceBar fraction={0.69} todayFraction={0.77} color={c.caution} accessibilityLabel="pace" />, mode);
    expect(flat(getByTestId('pace-bar-today').props.style).left).toBe('77%');
    expect(flat(getByTestId('pace-bar-fill').props.style).backgroundColor).toBe(c.caution);
  });

  it('ValueSlider snaps and responds to accessibility actions', () => {
    expect(snapValue(5740, 1000, 11000, 500)).toBe(5500);
    expect(snapValue(99999, 1000, 11000, 500)).toBe(11000);
    const onChange = jest.fn();
    const { getByTestId, getByText } = renderWithTheme(
      <ValueSlider testID="s" label="Eating out" value={6000} min={0} max={20000} step={500} bubble="6,000" onChange={onChange} />,
      mode,
    );
    expect(getByText('6,000')).toBeTruthy();
    fireEvent(getByTestId('s'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(6500);
    fireEvent(getByTestId('s'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(5500);
  });

  it('OutlinedField shows label, prefix, helper and error colour', () => {
    const a = renderWithTheme(<OutlinedField label="Target" prefix={'\u20B9'} value="60,000" helper="Optional" onChangeText={jest.fn()} />, mode);
    expect(a.getByText('Target')).toBeTruthy();
    expect(a.getByText('Optional')).toBeTruthy();
    const b = renderWithTheme(<OutlinedField label="Last 4 digits" value="44" error="Enter 4 digits" onChangeText={jest.fn()} />, mode);
    expect(flat(b.getByText('Enter 4 digits').props.style).color).toBe(c.error);
  });

  it('OutlinedField dropdown acts as a button', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(<OutlinedField label="Bank" dropdown value="HDFC Bank" onPress={onPress} />, mode);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('FilterChip reports checked state and presses', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(<FilterChip testID="c" label="Cash" selected onPress={onPress} />, mode);
    expect(getByTestId('c').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('c'));
    expect(onPress).toHaveBeenCalled();
  });

  it('SegmentedChoice selects an option', () => {
    const onChange = jest.fn();
    const { getByTestId } = renderWithTheme(
      <SegmentedChoice testID="sg" value="a" onChange={onChange} options={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]} />,
      mode,
    );
    expect(getByTestId('sg-a').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('sg-b'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('PillButton variants press and can be disabled', () => {
    const onPress = jest.fn();
    const a = renderWithTheme(<PillButton testID="p" label="Create goal" onPress={onPress} />, mode);
    expect(flat(a.getByTestId('p').props.style).backgroundColor).toBe(c.primary);
    fireEvent.press(a.getByTestId('p'));
    expect(onPress).toHaveBeenCalledTimes(1);
    const b = renderWithTheme(<PillButton testID="q" label="Create goal" variant="outlined" disabled onPress={onPress} />, mode);
    expect(b.getByTestId('q').props.accessibilityState.disabled).toBe(true);
  });

  it('TopBar and StackScreen render title, leading and trailing actions', () => {
    const back = jest.fn();
    const save = jest.fn();
    const { getByText, getByTestId, getByLabelText } = renderWithTheme(
      <StackScreen testID="ss" title="Edit budget" leading="close" onLeading={back} trailing={<TopBarAction text="Save" label="Save" onPress={save} />} footer={<TopBar title="footer" />}>
        {null}
      </StackScreen>,
      mode,
    );
    expect(getByText('Edit budget')).toBeTruthy();
    fireEvent.press(getByLabelText('Close', { exact: true }));
    expect(back).toHaveBeenCalled();
    fireEvent.press(getByText('Save'));
    expect(save).toHaveBeenCalled();
    expect(getByTestId('ss')).toBeTruthy();
  });

  it('AllocationSheet has one slider per account and reports changes and save', () => {
    const onChangeRow = jest.fn();
    const onSave = jest.fn();
    const rows = [
      { key: 'HDFC', name: 'HDFC Savings', icon: 'account_balance', paise: 2500000 },
      { key: 'SBI', name: 'SBI Salary', icon: 'account_balance', paise: 1000000 },
    ];
    const { getByTestId, getByText } = renderWithTheme(
      <AllocationSheet visible title="Where it sits" rows={rows} maxPaise={6000000} targetPaise={6000000} onChangeRow={onChangeRow} onSave={onSave} onClose={jest.fn()} />,
      mode,
    );
    expect(getByTestId('allocation-total').props.children).toBe('\u20B935,000 of \u20B960,000');
    expect(getByText('HDFC Savings')).toBeTruthy();
    fireEvent(getByTestId('allocation-slider-SBI'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChangeRow).toHaveBeenCalledWith('SBI', 1050000);
    fireEvent.press(getByTestId('allocation-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('OptionPicker lists options and selects one', () => {
    const onSelect = jest.fn();
    const { getByTestId } = renderWithTheme(<OptionPicker visible title="Bank" options={['HDFC Bank', 'SBI']} value="SBI" onSelect={onSelect} onClose={jest.fn()} />, mode);
    expect(getByTestId('option-SBI').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('option-HDFC Bank'));
    expect(onSelect).toHaveBeenCalledWith('HDFC Bank');
  });

  it('BeachChairIllustration has a tintable blob layer and ink layer', () => {
    const { getByTestId, getByLabelText } = renderWithTheme(<BeachChairIllustration />, mode);
    expect(getByLabelText('Illustration of a beach chair and a coconut')).toBeTruthy();
    expect(paint(getByTestId('illustration-tint').props.fill)).toBe(processColor(c.primaryContainer));
    expect(paint(getByTestId('illustration-ink').props.stroke)).toBe(processColor(c.onPrimaryContainer));
  });

  it('BeachChairIllustration accepts tint and ink overrides', () => {
    const { getByTestId } = renderWithTheme(<BeachChairIllustration tint={c.tertiaryContainer} ink={c.primary} />, mode);
    expect(paint(getByTestId('illustration-tint').props.fill)).toBe(processColor(c.tertiaryContainer));
    expect(paint(getByTestId('illustration-ink').props.stroke)).toBe(processColor(c.primary));
  });

  it('JarFill describes how full it is', () => {
    const { getByTestId } = renderWithTheme(<JarFill fraction={0.63} />, mode);
    expect(getByTestId('jar-fill').props.accessibilityLabel).toBe('Jar 63 percent full');
  });
});
