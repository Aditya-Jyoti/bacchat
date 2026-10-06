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
import { t } from '../../../lib/i18n';

const R = '\u20B9';

export function BannersCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <GalleryCard title={t('galleryUi.bannersInlineStates')} caption={t('galleryUi.bannerForOneTime')}>
      <Banner variant="insight" icon="sms" actionLabel={t('galleryUi.allow')}>{t('galleryUi.letBacchatReadBank')}</Banner>
      <Banner variant="caution" icon="cloud_off" actionLabel={t('galleryUi.retry')}>{t('galleryUi.offlineUBPrices')}</Banner>
      <Banner variant="caution" icon="image_not_supported" actionLabel={t('galleryUi.tryAgain')}>{t('galleryUi.couldnTReadThis')}</Banner>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}>
        <Glyph name="local_cafe" size={36} color={colors.onSurfaceVariant} />
        <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{t('galleryUi.nothingHereYet')}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.entriesYouAddWill')}</Text>
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
    <GalleryCard title={t('galleryUi.progressSteppers')} caption={t('galleryUi.stepperForMultiStep')}>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.flowStepperScreenshotImport')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {step(1, t('galleryUi.upload'), 'done')}
        <View style={{ width: 16, height: 1, backgroundColor: colors.outlineVariant }} />
        {step(2, t('galleryUi.review'), 'active')}
        <View style={{ width: 16, height: 1, backgroundColor: colors.outlineVariant }} />
        {step(3, t('galleryUi.done'), 'todo')}
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.numberStepperSplitBetween')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <NumberStepper testID="gallery-stepper" label={t('galleryUi.people')} value={people} min={1} max={10} onChange={setPeople} format={(v) => `${v} people`} />
        <View>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{`${R}${Math.round(1485 / people)} each`}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.ofRs')}</Text>
        </View>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.peopleAvatarsAndOwed')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AvatarStack items={[{ id: 'p', name: 'Priya' }, { id: 'a', name: 'Arjun' }, { id: 'm', name: 'Meera' }, { id: 'k', name: 'Karan' }]} max={2} />
        <Text style={[typography.bodySmall, { color: colors.onSurface }]}>{t('galleryUi.priyaOwesRs')}</Text>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.goalMilestoneRing')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View testID="goal-ring" accessible accessibilityRole="progressbar" accessibilityLabel={t('galleryUi.goaPercent')} accessibilityValue={{ min: 0, max: 100, now: 63 }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceContainerHigh} strokeWidth={6} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray={`${circ}`} strokeDashoffset={circ * 0.37} />
          </Svg>
          <Text style={[typography.titleMedium, { color: colors.onSurface }]}>63%</Text>
        </View>
        <View>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('galleryUi.goa')}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.nextMilestoneAt')}</Text>
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
    <GalleryCard title={t('galleryUi.appBarsNavigation')} caption={t('galleryUi.badgesANumberMeans')}>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.smallSubPages')}</Text>
      <TopBar title={t('galleryUi.settings')} trailing={<TopBarAction icon="more_vert" label={t('galleryUi.more')} />} />
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.largeCollapses')}</Text>
      <View>
        <TopBar trailing={<TopBarAction icon="search" label={t('galleryUi.search2')} />} />
        <Text style={[typography.headlineSmall, { color: colors.onSurface, paddingHorizontal: 16 }]}>{t('galleryUi.entries')}</Text>
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.contextualSelected')}</Text>
      <TopBar title={t('galleryUi.selected')} leading="close" trailing={<TopBarAction icon="delete" label={t('galleryUi.delete')} />} />
      <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceContainer, paddingVertical: 12, borderRadius: 16 }}>
        {nav('home', t('galleryUi.home'), true)}
        {nav('receipt_long', t('galleryUi.money'), false, 2)}
        {nav('flag', t('galleryUi.goals'), false)}
        {nav('person', t('galleryUi.you'), false)}
      </View>
    </GalleryCard>
  );
}

export function AmountsCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const label = (s: string) => <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{s}</Text>;
  return (
    <GalleryCard title={t('galleryUi.amounts')} caption={t('galleryUi.spendsAreNeverRed')}>
      {label(t('galleryUi.hero'))}
      <Amount paise={182235000} variant="displayMedium" />
      {label(t('galleryUi.hiddenTapToShow'))}
      <Text accessibilityLabel={t('galleryUi.amountHidden')} style={[typography.headlineSmall, { color: colors.onSurface }]}>{t('galleryUi.rsUUU')}</Text>
      {label(t('galleryUi.compactInCharts'))}
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('galleryUi.rsLUB')}</Text>
      {label(t('galleryUi.moneyIn'))}
      <Amount paise={89900} income />
      {label(t('galleryUi.moneyOut'))}
      <Amount paise={48600} />
      {label(t('galleryUi.debt'))}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Amount paise={2000000} variant="bodyLarge" />
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.owed')}</Text>
      </View>
      {label(t('galleryUi.delta'))}
      <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('galleryUi.uRs')}</Text>
    </GalleryCard>
  );
}
