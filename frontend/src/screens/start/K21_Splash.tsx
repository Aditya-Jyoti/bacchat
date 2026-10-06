/** k21: Splash. About 600 ms while the local database opens, then Welcome (first run) or Home. */
import React, { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { useReduceMotion } from '../../components/useReduceMotion';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { useFirstRun } from './firstRun';
import { t } from '../../lib/i18n';

export const SPLASH_MS = 600;
const TRACK = 120;

export default function K21_Splash(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { go } = useGo();
  const reduce = useReduceMotion();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const id = setTimeout(() => go(useFirstRun.getState().seen ? 'k1' : 'k22'), SPLASH_MS);
    return () => clearTimeout(id);
  }, [go]);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 900, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, slide]);

  const seg = TRACK * 0.45;
  const x = reduce ? TRACK * 0.2 : slide.interpolate({ inputRange: [0, 1], outputRange: [-seg, TRACK] });

  return (
    <SafeAreaView testID="screen-k21" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <View
          accessibilityLabel={t('startUi.appMark')}
          style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="savings" size={64} color={colors.onPrimaryContainer} />
        </View>
        <Text style={[typography.displayMedium, { fontSize: 44, lineHeight: 44, color: colors.onSurface, marginTop: 28 }]}>{t('startUi.name')}</Text>
        <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }]}>
          {t('startUi.subtitle', { hindi: '\u092C\u091A\u0924' })}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 48, paddingBottom: 56, alignItems: 'center', gap: 16 }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('startUi.opening')}
          style={{ width: TRACK, height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}
        >
          <Animated.View
            testID="splash-progress"
            style={{ position: 'absolute', top: 0, bottom: 0, width: seg, borderRadius: 2, backgroundColor: colors.primary, transform: [{ translateX: x }] }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Glyph name="lock" size={14} color={colors.onSurfaceVariant} />
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('startUi.openingLine')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
