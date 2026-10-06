/** k7: Reading screenshot. Scan band over the image, an overall progress bar and skeleton rows that become real rows; advances to k8 when done. */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import { screenshotRows } from '../../data';
import { useTheme } from '../../theme';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { Icon, PillButton, ScreenFrame, TopBar } from './parts/ui';
import { ScanImage, SkeletonRow } from './review/ReadingVisuals';

/** Time between lines read; the whole read takes about 2.5 s, on the phone. */
export const READ_STEP_MS = 250;
const TOTAL = screenshotRows.length;
const SKELETONS: { opacity: number; w: `${number}%` }[] = [
  { opacity: 0.82, w: '67%' },
  { opacity: 0.64, w: '74%' },
  { opacity: 0.46, w: '81%' },
  { opacity: 0.28, w: '88%' },
];

export default function K7_ReadingScreenshot(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const nav = useMoneyNav();
  const [line, setLine] = useState(6);
  const { replace } = nav;

  useEffect(() => {
    const id = setTimeout(() => {
      if (line >= TOTAL) replace('k8');
      else setLine((l) => l + 1);
    }, READ_STEP_MS);
    return () => clearTimeout(id);
  }, [line, replace]);

  const shown = screenshotRows.slice(0, Math.max(0, line - 4));
  const skeletons = SKELETONS.slice(0, Math.max(0, Math.min(4, TOTAL - shown.length)));
  return (
    <ScreenFrame testID="screen-k7">
      <TopBar icon="arrow_back" iconLabel={S.back} onIcon={() => nav.back()} title={S.readingTitle} />
      <View style={{ flex: 1, paddingHorizontal: spacing.screenMargin }}>
        <ScanImage caption={S.shotCaption} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Text testID="reading-line" style={[typography.labelLarge, { color: colors.onSurface }]}>
            {fmt(S.readingLine, { n: line, total: TOTAL })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={14} color={colors.onSurfaceVariant} />
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{S.onThisPhone}</Text>
          </View>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: TOTAL, now: line }}
          style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, marginTop: spacing.sm, overflow: 'hidden' }}
        >
          <View testID="reading-progress" style={{ width: `${(line / TOTAL) * 100}%`, height: 4, backgroundColor: colors.primary }} />
        </View>
        <View style={{ marginTop: 14 }}>
          {shown.map((r) => (
            <View key={r.name} testID={`read-${r.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
              <CategoryIcon name={r.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{r.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{r.time}</Text>
              </View>
              <Amount paise={r.amount.paise} />
            </View>
          ))}
          {skeletons.map((s) => (
            <SkeletonRow key={s.opacity} opacity={s.opacity} titleWidth={s.w} />
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
        <PillButton testID="cancel" label={S.cancel} kind="outlined" onPress={() => nav.back()} />
      </View>
    </ScreenFrame>
  );
}
