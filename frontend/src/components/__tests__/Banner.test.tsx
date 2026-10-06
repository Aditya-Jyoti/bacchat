import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { Banner } from '../Banner';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe.each(['light', 'dark'] as const)('Banner (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('insight uses tertiaryContainer', () => {
    const { getByTestId, getByText } = renderWithTheme(<Banner>Two card bills are due</Banner>, mode);
    expect(flat(getByTestId('banner-insight').props.style).backgroundColor).toBe(c.tertiaryContainer);
    expect(getByText('Two card bills are due')).toBeTruthy();
    expect(getByText('auto-awesome', { includeHiddenElements: true })).toBeTruthy();
  });

  it('caution uses the caution container, never error', () => {
    const { getByTestId } = renderWithTheme(<Banner variant="caution">Eating out is over</Banner>, mode);
    const s = flat(getByTestId('banner-caution').props.style);
    expect(s.backgroundColor).toBe(c.caution);
    expect(s.backgroundColor).not.toBe(c.error);
  });

  it('fires the action', () => {
    const onAction = jest.fn();
    const { getByText } = renderWithTheme(
      <Banner variant="caution" actionLabel="Okay" onAction={onAction}>
        Over
      </Banner>,
      mode,
    );
    fireEvent.press(getByText('Okay'));
    expect(onAction).toHaveBeenCalled();
  });
});
