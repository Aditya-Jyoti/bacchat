import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue } from 'react-native';

import { useTheme } from '../theme';
import { t } from '../lib/i18n';

export type SkeletonLoaderProps = {
  width?: DimensionValue;
  height?: number;
  /** Corner radius (default 8). */
  radius?: number;
  testID?: string;
};

/** One placeholder bar in surfaceContainerHigh with a slow pulse (no pulse when reduce motion is on). */
export function SkeletonLoader({ width = '100%', height = 14, radius = 8, testID = 'skeleton' }: SkeletonLoaderProps): React.JSX.Element {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let live = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((reduce) => {
        if (!live || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          ]),
        );
        loop.start();
      })
      .catch(() => undefined);
    return () => {
      live = false;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, backgroundColor: colors.surfaceContainerHigh, opacity }}
    />
  );
}

export type SkeletonRowsProps = { count?: number; testID?: string };

/** List-row skeletons: a 40dp circle and two text bars. Announces "Loading" once. */
export function SkeletonRows({ count = 3, testID = 'skeleton-rows' }: SkeletonRowsProps): React.JSX.Element {
  return (
    <View testID={testID} accessible accessibilityLabel={t('componentsUi.loading')} accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
          <SkeletonLoader width={40} height={40} radius={20} testID="skeleton-circle" />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonLoader width="60%" height={14} />
            <SkeletonLoader width="35%" height={10} />
          </View>
          <SkeletonLoader width={48} height={14} />
        </View>
      ))}
    </View>
  );
}
