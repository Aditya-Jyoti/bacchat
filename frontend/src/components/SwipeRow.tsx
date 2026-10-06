import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { resolveIconName } from './iconMap';

export type SwipeAction = {
  label: string;
  /** Material Symbols name. */
  icon: string;
  onTrigger: () => void;
  /** Delete style: label and icon in error on surfaceContainerHigh. Otherwise primaryContainer. */
  destructive?: boolean;
};

export type SwipeRowProps = {
  children: React.ReactNode;
  /** Revealed by swiping right (for example "Looks right"). */
  rightSwipe?: SwipeAction;
  /** Revealed by swiping left (for example "Delete"). */
  leftSwipe?: SwipeAction;
  /** Start partly open (dp, positive reveals the right-swipe action) to show the affordance. */
  peek?: number;
  height?: number;
  accessibilityLabel?: string;
  testID?: string;
};

export const SWIPE_THRESHOLD = 96;

/** Which action a drag of dx dp commits, or null when it falls short or has no action. */
export function resolveSwipe(dx: number, hasRight: boolean, hasLeft: boolean, threshold = SWIPE_THRESHOLD): 'right' | 'left' | null {
  if (dx >= threshold && hasRight) return 'right';
  if (dx <= -threshold && hasLeft) return 'left';
  return null;
}

/**
 * Row with swipe-to-dismiss actions. The content slides over a tinted action layer; releasing
 * past the threshold fires the action and the row settles back. TalkBack gets the same actions
 * as custom accessibility actions.
 */
export function SwipeRow({ children, rightSwipe, leftSwipe, peek = 0, height = 60, accessibilityLabel, testID }: SwipeRowProps): React.JSX.Element {
  const { colors, shapes, typography, spacing } = useTheme();
  const [x] = useState(() => new Animated.Value(peek));
  // Mutable gesture state is created once, together with the responder that uses it.
  const [bag] = useState(() => {
    const g = { base: peek, reduce: false, right: undefined as SwipeAction | undefined, left: undefined as SwipeAction | undefined };
    const settle = (to: number): void => {
      g.base = to;
      Animated.timing(x, { toValue: to, duration: g.reduce ? 0 : 160, useNativeDriver: true }).start();
    };
    const pan = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, st) => Math.abs(st.dx) > 8 && Math.abs(st.dx) > Math.abs(st.dy) * 1.5,
      onPanResponderMove: (_e, st) => {
        const next = g.base + st.dx;
        x.setValue(Math.max(g.left ? -SWIPE_THRESHOLD * 1.6 : 0, Math.min(g.right ? SWIPE_THRESHOLD * 1.6 : 0, next)));
      },
      onPanResponderRelease: (_e, st) => {
        const hit = resolveSwipe(g.base + st.dx, !!g.right, !!g.left);
        const [r, l] = [g.right, g.left];
        settle(0);
        if (hit === 'right') r?.onTrigger();
        if (hit === 'left') l?.onTrigger();
      },
      onPanResponderTerminate: () => settle(0),
    });
    const sync = (right?: SwipeAction, left?: SwipeAction): void => {
      g.right = right;
      g.left = left;
    };
    const setReduce = (v: boolean): void => {
      g.reduce = v;
    };
    return { pan, sync, setReduce };
  });
  const { pan } = bag;

  useEffect(() => {
    bag.sync(rightSwipe, leftSwipe);
  }, [bag, rightSwipe, leftSwipe]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => {
        bag.setReduce(!!v);
      })
      .catch(() => undefined);
  }, [bag]);

  const layer = (a: SwipeAction, swipe: 'right' | 'left'): React.JSX.Element => {
    const bg = a.destructive ? colors.surfaceContainerHigh : colors.primaryContainer;
    const fg = a.destructive ? colors.error : colors.onPrimaryContainer;
    return (
      <Animated.View
        testID={`swipe-${swipe}-layer`}
        style={{
          opacity: x.interpolate({ inputRange: [-1, 0, 1], outputRange: swipe === 'right' ? [0, 0, 1] : [1, 0, 0], extrapolate: 'clamp' }),
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: swipe === 'right' ? 'flex-start' : 'flex-end',
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        }}
      >
        {swipe === 'left' ? <Text style={[typography.labelLarge, { color: fg }]}>{a.label}</Text> : null}
        <MaterialIcons name={resolveIconName(a.icon)} size={22} color={fg} />
        {swipe === 'right' ? <Text style={[typography.labelLarge, { color: fg }]}>{a.label}</Text> : null}
      </Animated.View>
    );
  };

  const a11yActions = [
    ...(rightSwipe ? [{ name: 'swipeRight', label: rightSwipe.label }] : []),
    ...(leftSwipe ? [{ name: 'swipeLeft', label: leftSwipe.label }] : []),
  ];

  return (
    <View
      testID={testID ?? 'swipe-row'}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={a11yActions}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'swipeRight') rightSwipe?.onTrigger();
        if (e.nativeEvent.actionName === 'swipeLeft') leftSwipe?.onTrigger();
      }}
      style={{ height, borderRadius: shapes.field, overflow: 'hidden', backgroundColor: colors.surfaceContainerHigh }}
      {...pan.panHandlers}
    >
      {rightSwipe ? layer(rightSwipe, 'right') : null}
      {leftSwipe ? layer(leftSwipe, 'left') : null}
      <Animated.View
        testID="swipe-content"
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: shapes.field,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          gap: spacing.md,
          transform: [{ translateX: x }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
