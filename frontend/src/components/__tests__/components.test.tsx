import React from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import {
  Amount,
  CategoryIcon,
  Hairline,
  ListRow,
  ScreenScaffold,
  SectionHeader,
  Tag,
  isKnownIcon,
  resolveIconName,
} from '..';

const R = '\u20B9';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('components (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('Hairline uses outlineVariant', () => {
    const { getByTestId } = renderWithTheme(<Hairline inset={52} />, mode);
    const s = flat(getByTestId('hairline').props.style);
    expect(s.backgroundColor).toBe(c.outlineVariant);
    expect(s.height).toBe(1);
    expect(s.marginLeft).toBe(52);
  });

  it('SectionHeader renders a serif title with the 22dp gap and an action', () => {
    const onAction = jest.fn();
    const { getByText, getByRole } = renderWithTheme(
      <SectionHeader title="Coming up" action="See all" onAction={onAction} />,
      mode,
    );
    const s = flat(getByText('Coming up').props.style);
    expect(String(s.fontFamily)).toContain('YoungSerif');
    expect(s.color).toBe(c.onSurface);
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  it('CategoryIcon inverts when selected', () => {
    const a = renderWithTheme(<CategoryIcon name="local_cafe" />, mode);
    expect(flat(a.getByTestId('category-icon', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.secondaryContainer);
    expect(flat(a.getByTestId('category-icon', { includeHiddenElements: true }).props.style).width).toBe(40);
    const b = renderWithTheme(<CategoryIcon name="local_cafe" selected />, mode);
    expect(flat(b.getByTestId('category-icon', { includeHiddenElements: true }).props.style).backgroundColor).toBe(c.primary);
  });

  it('Amount: spend has no minus and uses onSurface; income is primary with +', () => {
    const spend = renderWithTheme(<Amount paise={-124900} />, mode);
    expect(spend.getByTestId('amount').props.children).toBe(`${R}1,249`);
    expect(flat(spend.getByTestId('amount').props.style).color).toBe(c.onSurface);
    const inc = renderWithTheme(<Amount paise={89900} income />, mode);
    expect(inc.getByTestId('amount').props.children).toBe(`+${R}899`);
    expect(flat(inc.getByTestId('amount').props.style).color).toBe(c.primary);
    const compact = renderWithTheme(<Amount paise={182235000} compact />, mode);
    expect(compact.getByTestId('amount').props.children).toBe(`${R}18.2L`);
  });

  it('Tag carries words and tertiary colours for review', () => {
    const r = renderWithTheme(<Tag kind="toReview" />, mode);
    expect(r.getByText('TO REVIEW')).toBeTruthy();
    expect(flat(r.getByTestId('tag-toReview').props.style).backgroundColor).toBe(c.tertiaryContainer);
    expect(renderWithTheme(<Tag kind="matched" />, mode).getByText('MATCHED')).toBeTruthy();
    expect(renderWithTheme(<Tag kind="resolved" />, mode).getByText('RESOLVED')).toBeTruthy();
  });

  it('ListRow shows title, subtitle, trailing and handles press', () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(
      <ListRow
        testID="row"
        title="Swiggy"
        subtitle="Eating out"
        icon="restaurant"
        trailing={<Amount paise={48600} />}
        onPress={onPress}
      />,
      mode,
    );
    expect(getByText('Swiggy')).toBeTruthy();
    expect(getByText('Eating out')).toBeTruthy();
    expect(getByText(`${R}486`)).toBeTruthy();
    fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ListRow without handlers is a plain view', () => {
    const { getByTestId } = renderWithTheme(<ListRow testID="row" title="Plain" />, mode);
    expect(getByTestId('row')).toBeTruthy();
  });

  it('ScreenScaffold renders title and children on the surface', () => {
    const { getByText, getByTestId } = renderWithTheme(
      <ScreenScaffold testID="scaffold" title="Money">
        <Text>child</Text>
      </ScreenScaffold>,
      mode,
    );
    expect(getByText('Money')).toBeTruthy();
    expect(getByText('child')).toBeTruthy();
    expect(flat(getByTestId('scaffold').props.style).backgroundColor).toBe(c.surface);
  });

  it('ScreenScaffold without scroll', () => {
    const { getByText } = renderWithTheme(
      <ScreenScaffold scroll={false}>
        <Text>fixed</Text>
      </ScreenScaffold>,
      mode,
    );
    expect(getByText('fixed')).toBeTruthy();
  });
});

describe('iconMap', () => {
  it('maps design icon names and falls back', () => {
    expect(resolveIconName('local_cafe')).toBe('local-cafe');
    expect(resolveIconName('nutrition')).toBe('eco');
    expect(resolveIconName('screenshot_region')).toBe('screenshot');
    expect(resolveIconName('totally_unknown_icon')).toBe('label-outline');
    expect(isKnownIcon('restaurant')).toBe(true);
    expect(isKnownIcon('nope_nope')).toBe(false);
  });
});
