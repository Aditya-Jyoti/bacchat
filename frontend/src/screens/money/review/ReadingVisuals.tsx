import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';

import { useTheme } from '../../../theme';

const STRIPES = 12;

/** The screenshot stand-in: striped surface with a scan band that sweeps down (static with reduce motion). */
export function ScanImage({ caption, height = 200 }: { caption: string; height?: number }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [y] = useState(() => new Animated.Value(0.42));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let dead = false;
    const start = (reduce: boolean): void => {
      if (dead || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: 0.85, duration: 1400, useNativeDriver: true }),
          Animated.timing(y, { toValue: 0.1, duration: 1400, useNativeDriver: true }),
        ]),
      );
      loop.start();
    };
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((r) => start(!!r))
      .catch(() => start(false));
    return () => {
      dead = true;
      loop?.stop();
    };
  }, [y]);
  return (
    <View
      testID="scan-image"
      accessible
      accessibilityLabel={caption}
      style={{ height, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceContainer, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14 }}
    >
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        {Array.from({ length: STRIPES }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.surfaceContainerHigh : colors.surfaceContainer }} />
        ))}
      </View>
      <Animated.View
        testID="scan-band"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 36,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, height - 36] }) }],
        }}
      >
        <View style={{ height: 34, backgroundColor: colors.primaryContainer, opacity: 0.8 }} />
        <View style={{ height: 2, backgroundColor: colors.primary }} />
      </Animated.View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{caption}</Text>
    </View>
  );
}

/** A row-shaped placeholder that fades with its position in the list. */
export function SkeletonRow({ opacity, titleWidth }: { opacity: number; titleWidth: `${number}%` }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      testID="skeleton-row"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, opacity }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, width: titleWidth, borderRadius: 6, backgroundColor: colors.surfaceContainerHigh }} />
        <View style={{ height: 10, width: '36%', borderRadius: 5, backgroundColor: colors.surfaceContainer }} />
      </View>
      <View style={{ width: 48, height: 12, borderRadius: 6, backgroundColor: colors.surfaceContainerHigh }} />
    </View>
  );
}
