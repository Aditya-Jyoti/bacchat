import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

import { Amount } from '../../../components/Amount';
import { AvatarStack } from '../../../components/AvatarStack';
import { Banner } from '../../../components/Banner';
import { NumberStepper } from '../../../components/NumberStepper';
import { TopBar, TopBarAction } from '../../../components/TopBar';
import { useTheme } from '../../../theme';
import { Glyph } from '../../you/parts/Glyph';
import { GalleryCard } from './GalleryFrame';

const R = '\u20B9';
const DOT = '\u00B7';

export function BannersCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <GalleryCard title="BANNERS & INLINE STATES" caption="Banner for one-time permission asks, offline line, calm error with retry, small empty state.">
      <Banner variant="insight" icon="sms" actionLabel="Allow">Let Bacchat read bank SMS so entries add themselves? It stays on this phone.</Banner>
      <Banner variant="caution" icon="cloud_off" actionLabel="Retry">{`Offline ${DOT} prices from 9:30 am`}</Banner>
      <Banner variant="caution" icon="image_not_supported" actionLabel="Try again">{"Couldn't read this screenshot. A sharper or uncropped one usually works."}</Banner>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}>
        <Glyph name="local_cafe" size={36} color={colors.onSurfaceVariant} />
        <Text style={[typography.titleMedium, { color: colors.onSurface }]}>Nothing here yet</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>Entries you add will show up here.</Text>
      </View>
    </GalleryCard>
  );
}

export function SteppersCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [people, setPeople] = useState(3);
  const size = 72;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const step = (n: number, label: string, state: 'done' | 'active' | 'todo') => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'todo' ? 'transparent' : colors.primary, borderWidth: state === 'todo' ? 1 : 0, borderColor: colors.outline }}>
        {state === 'done' ? <Glyph name="check" size={16} color={colors.onPrimary} /> : <Text style={[typography.labelSmall, { color: state === 'active' ? colors.onPrimary : colors.onSurfaceVariant }]}>{n}</Text>}
      </View>
      <Text style={[typography.labelMedium, { color: state === 'todo' ? colors.onSurfaceVariant : colors.onSurface }]}>{label}</Text>
    </View>
  );
  return (
    <GalleryCard title="PROGRESS & STEPPERS" caption="Stepper for multi-step flows, number stepper, avatar stack, circular goal ring.">
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Flow stepper, screenshot import</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {step(1, 'Upload', 'done')}
        <View style={{ width: 16, height: 1, backgroundColor: colors.outlineVariant }} />
        {step(2, 'Review', 'active')}
        <View style={{ width: 16, height: 1, backgroundColor: colors.outlineVariant }} />
        {step(3, 'Done', 'todo')}
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Number stepper, split between people</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <NumberStepper testID="gallery-stepper" label="People" value={people} min={1} max={10} onChange={setPeople} format={(v) => `${v} people`} />
        <View>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{`${R}${Math.round(1485 / people)} each`}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`of ${R}1,485`}</Text>
        </View>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>People, avatars and owed chips</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AvatarStack items={[{ id: 'p', name: 'Priya' }, { id: 'a', name: 'Arjun' }, { id: 'm', name: 'Meera' }, { id: 'k', name: 'Karan' }]} max={2} />
        <Text style={[typography.bodySmall, { color: colors.onSurface }]}>{`Priya owes ${R}495`}</Text>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Goal milestone, ring</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View testID="goal-ring" accessible accessibilityRole="progressbar" accessibilityLabel="Goa, 63 percent" accessibilityValue={{ min: 0, max: 100, now: 63 }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceContainerHigh} strokeWidth={6} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray={`${circ}`} strokeDashoffset={circ * 0.37} />
          </Svg>
          <Text style={[typography.titleMedium, { color: colors.onSurface }]}>63%</Text>
        </View>
        <View>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>Goa</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>Next milestone at 75%</Text>
        </View>
      </View>
    </GalleryCard>
  );
}

export function AppBarsCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = (icon: string, label: string, active: boolean, badge?: number) => (
    <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={{ width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.secondaryContainer : 'transparent' }}>
        <Glyph name={icon} size={22} color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant} />
        {badge ? <Badge size={16} style={{ position: 'absolute', top: -2, right: 8 }}>{badge}</Badge> : null}
      </View>
      <Text style={[typography.labelSmall, { color: active ? colors.onSurface : colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
  return (
    <GalleryCard title="APP BARS & NAVIGATION" caption="Badges: a number means things to review; a dot on You means backup needs attention.">
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Small, sub-pages</Text>
      <TopBar title="Settings" trailing={<TopBarAction icon="more_vert" label="More" />} />
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Large, collapses</Text>
      <View>
        <TopBar trailing={<TopBarAction icon="search" label="Search" />} />
        <Text style={[typography.headlineSmall, { color: colors.onSurface, paddingHorizontal: 16 }]}>Entries</Text>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>Contextual, 3 selected</Text>
      <TopBar title="3 selected" leading="close" trailing={<TopBarAction icon="delete" label="Delete" />} />
      <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceContainer, paddingVertical: 12, borderRadius: 16 }}>
        {nav('home', 'Home', true)}
        {nav('receipt_long', 'Money', false, 2)}
        {nav('flag', 'Goals', false)}
        {nav('person', 'You', false)}
      </View>
    </GalleryCard>
  );
}

export function AmountsCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const label = (s: string) => <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{s}</Text>;
  return (
    <GalleryCard title="AMOUNTS" caption="Spends are never red and never shown with a minus sign. Only income gets colour (primary). Debt carries a word, not a colour.">
      {label('Hero')}
      <Amount paise={182235000} variant="displayMedium" />
      {label('Hidden (tap to show)')}
      <Text accessibilityLabel="Amount hidden" style={[typography.headlineSmall, { color: colors.onSurface }]}>{`${R} \u2022\u2022\u2022\u2022\u2022\u2022`}</Text>
      {label('Compact, in charts')}
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{`${R}18.2L ${DOT} ${R}52k`}</Text>
      {label('Money in')}
      <Amount paise={89900} income />
      {label('Money out')}
      <Amount paise={48600} />
      {label('Debt')}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Amount paise={2000000} variant="bodyLarge" />
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>OWED</Text>
      </View>
      {label('Delta')}
      <Text style={[typography.labelLarge, { color: colors.primary }]}>{`\u2197 +${R}24,180`}</Text>
    </GalleryCard>
  );
}
