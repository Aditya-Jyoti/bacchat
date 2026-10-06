import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';
import { useReduceMotion } from './useReduceMotion';

export type ReorderableListProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  /** Row height in dp. Fixed so drag maths stays exact. */
  itemHeight: number;
  /** Called with the dragged item's old and new index. */
  onMove: (from: number, to: number) => void;
  /** Spoken name of an item for the move up/down actions. */
  getLabel: (item: T) => string;
  /** Render the row content; place `handle` where the drag handle should appear. */
  renderItem: (info: { item: T; index: number; handle: React.ReactNode }) => React.ReactNode;
};

type RowProps = {
  index: number;
  h: number;
  active: SharedValue<number>;
  ty: SharedValue<number>;
  animate: boolean;
  children: React.ReactNode;
};

function Row({ index, h, active, ty, animate, children }: RowProps): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    if (active.value < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (index === active.value) return { transform: [{ translateY: ty.value }], zIndex: 2 };
    const over = Math.round(active.value + ty.value / h);
    let shift = 0;
    if (active.value < index && index <= over) shift = -h;
    if (active.value > index && index >= over) shift = h;
    return { transform: [{ translateY: animate ? withTiming(shift, { duration: 120 }) : shift }], zIndex: 0 };
  });
  return <Animated.View style={[{ height: h }, style]}>{children}</Animated.View>;
}

/**
 * Drag-handle reorderable list (react-native-gesture-handler + reanimated). Rows must sit
 * inside a GestureHandlerRootView. The handle also exposes "Move up" / "Move down" as
 * accessibility actions, so reordering never needs a drag.
 */
export function ReorderableList<T>({
  data,
  keyExtractor,
  itemHeight,
  onMove,
  getLabel,
  renderItem,
}: ReorderableListProps<T>): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const reduce = useReduceMotion();
  const active = useSharedValue(-1);
  const ty = useSharedValue(0);
  const n = data.length;

  const move = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(n - 1, to));
    if (clamped !== from) onMove(from, clamped);
  };

  const handleFor = (item: T, index: number) => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(120)
      .onStart(() => {
        active.value = index;
        ty.value = 0;
      })
      .onUpdate((e) => {
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        const to = Math.round(index + e.translationY / itemHeight);
        active.value = -1;
        ty.value = 0;
        move(index, to);
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => move(index, index - 1));
    return (
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Reorder ${getLabel(item)}`}
          accessibilityHint="Drag to reorder"
          accessibilityActions={[
            { name: 'decrement', label: 'Move up' },
            { name: 'increment', label: 'Move down' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'decrement') move(index, index - 1);
            if (e.nativeEvent.actionName === 'increment') move(index, index + 1);
          }}
          testID={`drag-handle-${keyExtractor(item)}`}
          style={{ width: 32, height: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="drag_indicator" size={22} color={colors.onSurfaceVariant} />
        </View>
      </GestureDetector>
    );
  };

  return (
    <View style={{ height: itemHeight * n }}>
      {data.map((item, index) => (
        <Row key={keyExtractor(item)} index={index} h={itemHeight} active={active} ty={ty} animate={!reduce}>
          {renderItem({ item, index, handle: handleFor(item, index) })}
        </Row>
      ))}
    </View>
  );
}
