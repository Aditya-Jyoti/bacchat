import React, { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { useReduceMotion } from '../../../components/useReduceMotion';
import { useTheme } from '../../../theme';
import { t } from '../../../lib/i18n';

const BASE = [1, 0.6, 0.3];

/** Three pulsing dots shown while a reply streams. Static (1 / .6 / .3) under reduce motion. */
export function ThinkingDots(): React.JSX.Element {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const [vals] = useState(() => BASE.map((v) => new Animated.Value(v)));

  useEffect(() => {
    if (reduce) {
      vals.forEach((v, i) => v.setValue(BASE[i]));
      return;
    }
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 360, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, vals]);

  return (
    <View
      testID="thinking-dots"
      accessible
      accessibilityLabel={t('askUi.thinking')}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: 5, paddingVertical: 4, paddingHorizontal: 2 }}
    >
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: v }} />
      ))}
    </View>
  );
}
