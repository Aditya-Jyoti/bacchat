import React from 'react';
import { Text } from 'react-native';
import { act } from '@testing-library/react-native';

import { khataPalette } from '../../theme';
import { renderWithTheme } from '../../testUtils';
import { SWIPE_THRESHOLD, SwipeRow, resolveSwipe } from '../SwipeRow';

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

describe('resolveSwipe', () => {
  it('commits only past the threshold and only for a defined action', () => {
    expect(resolveSwipe(SWIPE_THRESHOLD, true, true)).toBe('right');
    expect(resolveSwipe(SWIPE_THRESHOLD - 1, true, true)).toBeNull();
    expect(resolveSwipe(-SWIPE_THRESHOLD, true, true)).toBe('left');
    expect(resolveSwipe(200, false, true)).toBeNull();
    expect(resolveSwipe(-200, true, false)).toBeNull();
  });
});

describe.each(['light', 'dark'] as const)('SwipeRow (%s)', (mode) => {
  const c = khataPalette(45, mode);

  function setup() {
    const confirm = jest.fn();
    const del = jest.fn();
    const utils = renderWithTheme(
      <SwipeRow
        accessibilityLabel="Swiggy"
        rightSwipe={{ label: 'Looks right', icon: 'check_circle', onTrigger: confirm }}
        leftSwipe={{ label: 'Delete', icon: 'delete', destructive: true, onTrigger: del }}
      >
        <Text>Swiggy</Text>
      </SwipeRow>,
      mode,
    );
    return { ...utils, confirm, del };
  }

  it('renders both action layers with the design colours and a 60dp row', () => {
    const { getByTestId, getByText } = setup();
    expect(flat(getByTestId('swipe-row').props.style).height).toBe(60);
    expect(flat(getByTestId('swipe-right-layer').props.style).backgroundColor).toBe(c.primaryContainer);
    expect(flat(getByTestId('swipe-left-layer').props.style).backgroundColor).toBe(c.surfaceContainerHigh);
    expect(flat(getByText('Delete').props.style).color).toBe(c.error);
    expect(flat(getByText('Looks right').props.style).color).toBe(c.onPrimaryContainer);
    expect(flat(getByTestId('swipe-content').props.style).backgroundColor).toBe(c.surface);
  });

  it('offers the actions to TalkBack and triggers them', () => {
    const { getByTestId, confirm, del } = setup();
    const row = getByTestId('swipe-row');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'swipeRight', label: 'Looks right' },
      { name: 'swipeLeft', label: 'Delete' },
    ]);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeRight' } }));
    expect(confirm).toHaveBeenCalledTimes(1);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeLeft' } }));
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('only renders the layers for actions that exist', () => {
    const { queryByTestId } = renderWithTheme(
      <SwipeRow rightSwipe={{ label: 'Looks right', icon: 'check_circle', onTrigger: jest.fn() }}>
        <Text>x</Text>
      </SwipeRow>,
      mode,
    );
    expect(queryByTestId('swipe-left-layer')).toBeNull();
    expect(queryByTestId('swipe-right-layer')).toBeTruthy();
  });
});
