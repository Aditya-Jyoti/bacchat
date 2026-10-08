import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '../../theme';

export type JarFillProps = {
  /** 0..1 how full the jar is. */
  fraction: number;
  /** Animate the fill from empty (skipped when the OS asks to reduce motion). Default false. */
  animate?: boolean;
  /** Width in dp; height is 1.2 x. Default 120. */
  size?: number;
};

const JAR = 'M34 22H86M38 22V30C26 38 24 48 24 60V112C24 122 32 128 42 128H78C88 128 96 122 96 112V60C96 48 94 38 82 30V22';

/** A jar that fills with primaryContainer coins-water as a goal is reached. Ink line in onPrimaryContainer. */
export function JarFill({ fraction, animate = false, size = 120 }: JarFillProps): React.JSX.Element {
  const { colors } = useTheme();
  const target = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const [shown, setShown] = useState(animate ? 0 : target);
  const [value] = useState(() => new Animated.Value(animate ? 0 : target));
  useEffect(() => {
    const id = value.addListener(({ value: v }) => setShown(v));
    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;
    if (!animate) {
      value.setValue(target);
      return () => value.removeListener(id);
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) value.setValue(target);
        else {
          running = Animated.timing(value, { toValue: target, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false });
          running.start();
        }
      })
      .catch(() => value.setValue(target));
    return () => {
      cancelled = true;
      running?.stop();
      value.removeListener(id);
    };
  }, [animate, target, value]);
  const top = 128 - shown * 100;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Jar ${Math.round(target * 100)} percent full`}
      testID="jar-fill"
      style={{ width: size, height: size * 1.2 }}
    >
      <Svg width={size} height={size * 1.2} viewBox="0 0 120 144">
        <Defs>
          <ClipPath id="jarClip">
            <Path d={`${JAR}Z`} />
          </ClipPath>
        </Defs>
        <Rect x={24} y={top} width={72} height={128 - top} fill={colors.primaryContainer} clipPath="url(#jarClip)" />
        <G stroke={colors.onPrimaryContainer} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d={JAR} />
          <Path d="M52 8C52 14 68 14 68 8" />
        </G>
      </Svg>
    </View>
  );
}
