import React, { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../../testUtils';
import { ReorderableList } from '../ReorderableList';

type Item = { id: string };

function Harness({ onMoveSpy }: { onMoveSpy?: (a: number, b: number) => void }) {
  const [items, setItems] = useState<Item[]>([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  return (
    <ReorderableList<Item>
      data={items}
      keyExtractor={(i) => i.id}
      itemHeight={60}
      getLabel={(i) => `Row ${i.id}`}
      onMove={(from, to) => {
        onMoveSpy?.(from, to);
        setItems((l) => {
          const n = l.slice();
          n.splice(to, 0, n.splice(from, 1)[0]);
          return n;
        });
      }}
      renderItem={({ item, handle }) => (
        <>
          {handle}
          <Text testID={`row-${item.id}`}>{item.id}</Text>
        </>
      )}
    />
  );
}

const order = (all: { props: { children?: unknown } }[]) => all.map((n) => n.props.children).join('');

describe.each(['light', 'dark'] as const)('ReorderableList (%s)', (mode) => {
  it('renders rows with handles', () => {
    const { getAllByTestId, getByLabelText } = renderWithTheme(<Harness />, mode);
    expect(order(getAllByTestId(/^row-/))).toBe('abc');
    expect(getByLabelText('Reorder Row b')).toBeTruthy();
  });

  it('moves down and up through accessibility actions', () => {
    const spy = jest.fn();
    const { getAllByTestId, getByTestId } = renderWithTheme(<Harness onMoveSpy={spy} />, mode);
    fireEvent(getByTestId('drag-handle-a'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(order(getAllByTestId(/^row-/))).toBe('bac');
    expect(spy).toHaveBeenLastCalledWith(0, 1);
    fireEvent(getByTestId('drag-handle-c'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(order(getAllByTestId(/^row-/))).toBe('bca');
  });

  it('ignores moves past the ends', () => {
    const spy = jest.fn();
    const { getByTestId } = renderWithTheme(<Harness onMoveSpy={spy} />, mode);
    fireEvent(getByTestId('drag-handle-a'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(spy).not.toHaveBeenCalled();
  });
});
