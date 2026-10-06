import React from 'react';

import { SCREEN_MANIFEST } from '../../navigation/screenManifest';
import { SCREEN_COMPONENTS } from '../../navigation/registry';
import { renderWithTheme } from '../../testUtils';

describe.each(['light', 'dark'] as const)('placeholder screens (%s)', (mode) => {
  it.each(SCREEN_MANIFEST.map((s) => [s.kid, s.title] as const))('%s renders its k-id and name', (kid, title) => {
    const Screen = SCREEN_COMPONENTS[kid];
    const { getByTestId } = renderWithTheme(<Screen />, mode);
    expect(getByTestId('placeholder-kid').props.children).toBe(kid);
    expect(getByTestId('placeholder-name').props.children).toBe(title);
  });
});
