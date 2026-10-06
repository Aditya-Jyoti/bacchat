import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChartTooltip } from '../../../components/ChartTooltip';
import { Glyph } from '../../you/parts/Glyph';
import { useTheme } from '../../../theme';
import { GalleryCard } from './GalleryFrame';
import { t } from '../../../lib/i18n';


function Sub({ children }: { children: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{children}</Text>;
}

function MenuItem({ icon, label }: { icon: string; label: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View accessibilityRole="menuitem" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16 }}>
      <Glyph name={icon} size={20} color={colors.onSurfaceVariant} />
      <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{label}</Text>
    </View>
  );
}

export function TooltipsCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [rich, setRich] = useState(true);
  return (
    <GalleryCard
      title={t('galleryUi.tooltips')}
      caption={t('galleryUi.plainSAfterLong')}
    >
      <Sub>{t('galleryUi.plainUBLong')}</Sub>
      <View style={{ alignItems: 'flex-start', gap: 4 }}>
        <ChartTooltip testID="tooltip-plain">{t('galleryUi.filterEntries')}</ChartTooltip>
        <Glyph name="tune" size={24} color={colors.onSurface} />
      </View>
      <Sub>{t('galleryUi.richUBTap')}</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{t('galleryUi.rs2')}</Text>
        <Pressable testID="tooltip-info" accessibilityRole="button" accessibilityLabel={t('galleryUi.aboutSpendableMoney')} onPress={() => setRich((v) => !v)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Glyph name="info" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
      {rich ? (
        <View testID="tooltip-rich" style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: 14, gap: 4 }}>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('galleryUi.spendableMoney')}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.banksAndCashMinus')}</Text>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('galleryUi.seeTheMaths')}</Text>
        </View>
      ) : null}
      <Sub>{t('galleryUi.chartUBHover')}</Sub>
      <ChartTooltip stemHeight={12} testID="tooltip-chart">
        <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{t('galleryUi.satOctRsU')}</Text>
      </ChartTooltip>
    </GalleryCard>
  );
}

export function LongPressCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <GalleryCard title={t('galleryUi.longPress')} caption={t('galleryUi.everyLongPressGives')}>
      <Sub>{t('galleryUi.onAHomeSection')}</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.field, paddingVertical: 8 }}>
        <MenuItem icon="dashboard_customize" label={t('galleryUi.arrangeHome')} />
        <MenuItem icon="visibility_off" label={t('galleryUi.hideThisSection')} />
        <MenuItem icon="open_in_new" label={t('galleryUi.openGoals')} />
      </View>
      <Sub>{t('galleryUi.onAnAmountCopy')}</Sub>
      <Text
        testID="long-press-amount"
        onLongPress={() => setCopied(true)}
        accessibilityHint={t('galleryUi.longPressToCopy')}
        style={[typography.headlineSmall, { color: colors.onSurface, paddingVertical: 8 }]}
      >{t('galleryUi.rs3')}</Text>
      {copied ? (
        <View testID="copied-snackbar" style={{ backgroundColor: colors.inverseSurface, borderRadius: shapes.field, padding: 12, flexDirection: 'row', gap: 8 }}>
          <Glyph name="content_copy" size={18} color={colors.inverseOnSurface} />
          <Text style={[typography.bodyMedium, { color: colors.inverseOnSurface }]}>{t('galleryUi.copiedRs')}</Text>
        </View>
      ) : null}
      <Sub>{t('galleryUi.onACategoryIcon')}</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Glyph name="local_cafe" size={24} color={colors.onSurface} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('galleryUi.teaCoffee')}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.entriesUBRs')}</Text>
        </View>
        <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('galleryUi.rename')}</Text>
        <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('galleryUi.merge')}</Text>
      </View>
    </GalleryCard>
  );
}

export function GesturesCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const row = (label: string, extra?: React.ReactNode) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <Glyph name="drag_indicator" size={22} color={colors.onSurfaceVariant} />
      <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{label}</Text>
      {extra}
    </View>
  );
  return (
    <GalleryCard title={t('galleryUi.gestures')} caption={t('galleryUi.reorderLongPressThe')}>
      <Sub>{t('galleryUi.dragToReorderLifted')}</Sub>
      {row(t('galleryUi.thisMonth'))}
      <View style={{ height: 2, backgroundColor: colors.primary }} />
      {row(t('galleryUi.comingUp'), <Glyph name="check" size={20} color={colors.primary} />)}
      {row(t('galleryUi.goals'))}
      <Sub>{t('galleryUi.pullToRefreshFund')}</Sub>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Glyph name="refresh" size={24} color={colors.primary} />
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.releaseToUpdateNavs')}</Text>
      </View>
      <Sub>{t('galleryUi.swipeAReviewCard')}</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryContainer, borderRadius: shapes.card, overflow: 'hidden' }}>
        <View style={{ padding: 16 }}>
          <Glyph name="check" size={22} color={colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surfaceContainer, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Glyph name="restaurant" size={22} color={colors.onSurface} />
          <View>
            <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('galleryUi.swiggyUBRs')}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('galleryUi.fromSms')}</Text>
          </View>
        </View>
      </View>
    </GalleryCard>
  );
}

export function SheetsCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const act = (icon: string, title: string, sub: string) => (
    <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 }}>
      <Glyph name={icon} size={24} color={colors.onSurface} />
      <View>
        <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{sub}</Text>
      </View>
    </View>
  );
  return (
    <GalleryCard title={t('galleryUi.sheetsMenus')} caption={t('galleryUi.modalbottomsheetWithDragHandle')}>
      <Sub>{t('galleryUi.actionSheetFromScreenshot')}</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet, padding: 20, gap: 4 }}>
        <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, marginBottom: 12 }} />
        <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 8 }]}>{t('galleryUi.addFromAScreenshot')}</Text>
        {act('photo_library', t('galleryUi.chooseFromGallery'), t('galleryUi.recentScreenshotsFirst'))}
        {act('photo_camera', t('galleryUi.takeAPhoto'), t('galleryUi.ofABillOr'))}
        {act('content_paste', t('galleryUi.pasteImage'), t('galleryUi.fromClipboard'))}
        {act('share', t('galleryUi.shareIntoBacchat'), t('galleryUi.fromAnyAppsShareMenu'))}
      </View>
      <Sub>{t('galleryUi.overflowMenuWithSections')}</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.field, paddingVertical: 8, alignSelf: 'flex-start', minWidth: 220 }}>
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingVertical: 4 }]}>{t('galleryUi.sort')}</Text>
        <MenuItem icon="check" label={t('galleryUi.newestFirst')} />
        <MenuItem icon="sort" label={t('galleryUi.biggestFirst')} />
        <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: 4 }} />
        <MenuItem icon="ios_share" label={t('galleryUi.exportOctober')} />
        <MenuItem icon="visibility_off" label={t('galleryUi.hideAmounts')} />
      </View>
    </GalleryCard>
  );
}
