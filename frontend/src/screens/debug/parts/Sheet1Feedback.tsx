import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator, Badge, Button, ProgressBar } from 'react-native-paper';

import { Amount } from '../../../components/Amount';
import { Banner } from '../../../components/Banner';
import { ListRow } from '../../../components/ListRow';
import { Tag } from '../../../components/Tag';
import { SkeletonLoader, SkeletonRows } from '../../../components/SkeletonLoader';
import { ValueSlider } from '../../../components/ValueSlider';
import { useTheme } from '../../../theme';
import { Glyph } from '../../you/parts/Glyph';
import { GalleryCard } from './GalleryFrame';

const R = '\u20B9';
const DOT = '\u00B7';
const ELLIPSIS = '\u2026';

export function SlidersCard(): React.JSX.Element {
  const [v, setV] = useState(5500);
  const [pct, setPct] = useState(90);
  const { colors, typography } = useTheme();
  return (
    <GalleryCard title="SLIDERS" caption="Continuous with value label, range (search filter), discrete with stops (alert threshold).">
      <View style={{ paddingTop: 28 }}>
        <ValueSlider testID="slider-amount" label="Amount" value={v} min={500} max={10000} step={500} onChange={setV} bubble={`${R}${v.toLocaleString('en-IN')}`} valueText={`${R}${v}`} />
      </View>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`Amount between ${R}500 - ${R}3,000`}</Text>
      <ValueSlider label="Alert threshold" value={pct} min={50} max={100} step={10} onChange={setPct} valueText={`${pct}%`} />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`Alert at ${pct}% of a category`}</Text>
    </GalleryCard>
  );
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export function DateTimeCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [day, setDay] = useState(24);
  const [pm, setPm] = useState(false);
  const cells = [...Array<null>(4).fill(null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
  return (
    <GalleryCard title="DATE & TIME" caption="Date range (for filters) and time input. Single-date dialog is in k6.">
      <Text style={[typography.titleMedium, { color: colors.onSurface }]}>October 2026</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[typography.labelSmall, { width: '14.28%', textAlign: 'center', color: colors.onSurfaceVariant }]}>{w}</Text>
        ))}
        {cells.map((d, i) => (
          <Text
            key={i}
            testID={d ? `date-${d}` : undefined}
            accessibilityRole={d ? 'button' : undefined}
            onPress={d ? () => setDay(d) : undefined}
            style={[
              typography.labelMedium,
              {
                width: '14.28%',
                height: 40,
                textAlign: 'center',
                textAlignVertical: 'center',
                lineHeight: 40,
                color: d === day ? colors.onPrimary : colors.onSurface,
                backgroundColor: d === day ? colors.primary : 'transparent',
                borderRadius: 20,
                overflow: 'hidden',
              },
            ]}
          >
            {d ?? ''}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[typography.displayMedium, { color: colors.onPrimaryContainer, backgroundColor: colors.primaryContainer, paddingHorizontal: 12, borderRadius: 8 }]}>05</Text>
        <Text style={[typography.displayMedium, { color: colors.onSurface }]}>:</Text>
        <Text style={[typography.displayMedium, { color: colors.onSurface, backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 12, borderRadius: 8 }]}>30</Text>
        <View style={{ marginLeft: 8 }}>
          <Text testID="time-am" accessibilityRole="button" onPress={() => setPm(false)} style={[typography.labelLarge, { padding: 8, color: pm ? colors.onSurfaceVariant : colors.onSecondaryContainer, backgroundColor: pm ? 'transparent' : colors.secondaryContainer }]}>AM</Text>
          <Text testID="time-pm" accessibilityRole="button" onPress={() => setPm(true)} style={[typography.labelLarge, { padding: 8, color: pm ? colors.onSecondaryContainer : colors.onSurfaceVariant, backgroundColor: pm ? colors.secondaryContainer : 'transparent' }]}>PM</Text>
        </View>
      </View>
    </GalleryCard>
  );
}

export function LoadersCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <GalleryCard title="LOADERS" caption="Circular (determinate), thinking dots, pull-to-refresh, linear determinate and indeterminate, skeleton rows, inline sync.">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <ActivityIndicator testID="loader-circular" animating />
        <ActivityIndicator animating size="small" />
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel="Thinking">
          {[1, 0.6, 0.3].map((o) => (
            <View key={o} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: o }} />
          ))}
        </View>
      </View>
      <ProgressBar testID="loader-determinate" progress={0.5} />
      <ProgressBar indeterminate />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Glyph name="sync" size={18} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{`Updating fund prices${ELLIPSIS}`}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>3 of 6</Text>
      </View>
      <SkeletonRows count={2} />
      <SkeletonLoader width="70%" height={16} />
    </GalleryCard>
  );
}

export function FeedbackCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  return (
    <GalleryCard title="FEEDBACK" caption="Snackbar, calm alert, insight, dialog, tooltip, nav badge (only place a red-ish tone appears, as a count).">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.inverseSurface, borderRadius: shapes.field, padding: 14 }}>
        <Glyph name="check_circle" size={20} color={colors.inverseOnSurface} />
        <Text style={[typography.bodyMedium, { flex: 1, color: colors.inverseOnSurface }]}>8 entries added</Text>
        <Text style={[typography.labelLarge, { color: colors.inverseOnSurface }]}>Undo</Text>
      </View>
      <Banner variant="caution" icon="spa" actionLabel="Okay">{`Eating out went ${R}640 past its budget. No stress.`}</Banner>
      <Banner variant="insight">{`Groceries are ${R}1,120 lower than September.`}</Banner>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.sheet, padding: 24, gap: 8 }}>
        <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>Delete this entry?</Text>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{`${R}486 at Swiggy will be removed. If it came from an SMS, Bacchat won't add it again.`}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button>Keep</Button>
          <Button textColor={colors.error}>Delete</Button>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ backgroundColor: colors.inverseSurface, borderRadius: shapes.field, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{`Matched with SMS`}</Text>
        </View>
        <View>
          <Glyph name="receipt_long" size={24} color={colors.onSurface} />
          <Badge size={16} style={{ position: 'absolute', top: -6, right: -8 }}>2</Badge>
        </View>
      </View>
    </GalleryCard>
  );
}

export function ListRowsCard(): React.JSX.Element {
  return (
    <GalleryCard title="LIST ROWS" caption="Default, AI to-review, conflict, income, skipped duplicate.">
      <ListRow icon="restaurant" title="Swiggy" subtitle={`Eating out ${DOT} ICICI credit card`} meta={<Tag kind="matched" />} trailing={<Amount paise={48600} />} />
      <ListRow icon="checkroom" title="Amazon" subtitle="From email, tap to check" meta={<Tag kind="toReview" />} trailing={<Amount paise={129900} />} />
      <ListRow icon="compare_arrows" title={`Amazon ${DOT} ${R}1,249`} subtitle={`Email says ${R}1,299, pick one`} />
      <ListRow icon="undo" title="Myntra refund" subtitle="Refund, HDFC Savings" trailing={<Amount paise={89900} income />} />
      <ListRow icon="local_cafe" title="Chai Point" subtitle="Duplicate, skipped" trailing={<Amount paise={4000} />} />
    </GalleryCard>
  );
}

export function MenuCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const items = [
    ['qr_code_2', `UPI ${DOT} rahul@okhdfc`, true],
    ['qr_code_2', `UPI ${DOT} rahul.s@ybl`, false],
    ['credit_card', 'ICICI Amazon Pay card', false],
    ['credit_card', 'HDFC Millennia card', false],
    ['payment', `HDFC debit ${'\u2022\u2022'}4021`, false],
    ['payments', 'Cash wallet', false],
  ] as const;
  return (
    <GalleryCard title="MENU" caption="Dropdown menu. Cards and UPI IDs are grouped by account.">
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.field, paddingVertical: 8 }}>
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingVertical: 4 }]}>Paid with</Text>
        {items.map(([icon, label, sel]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, backgroundColor: sel ? colors.secondaryContainer : 'transparent' }}>
            <Glyph name={icon} size={20} color={colors.onSurfaceVariant} />
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{label}</Text>
            {sel ? <Glyph name="check" size={20} color={colors.onSecondaryContainer} /> : null}
          </View>
        ))}
      </View>
    </GalleryCard>
  );
}
