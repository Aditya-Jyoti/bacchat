import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChartTooltip } from '../../../components/ChartTooltip';
import { Glyph } from '../../you/parts/Glyph';
import { useTheme } from '../../../theme';
import { GalleryCard } from './GalleryFrame';

const R = '\u20B9';
const DOT = '\u00B7';

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
      title="TOOLTIPS"
      caption="Plain: 1.5 s after long-press, auto-dismiss. Rich: tap, dismiss on outside tap. Chart: follows the finger and snaps to bars."
    >
      <Sub>{`Plain ${DOT} long-press an icon button`}</Sub>
      <View style={{ alignItems: 'flex-start', gap: 4 }}>
        <ChartTooltip testID="tooltip-plain">Filter entries</ChartTooltip>
        <Glyph name="tune" size={24} color={colors.onSurface} />
      </View>
      <Sub>{`Rich ${DOT} tap the info icon next to a number`}</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{`${R}5,23,150`}</Text>
        <Pressable testID="tooltip-info" accessibilityRole="button" accessibilityLabel="About spendable money" onPress={() => setRich((v) => !v)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Glyph name="info" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
      {rich ? (
        <View testID="tooltip-rich" style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: 14, gap: 4 }}>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>Spendable money</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{"Banks and cash, minus what you owe on cards right now. Investments aren't counted."}</Text>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>See the maths</Text>
        </View>
      ) : null}
      <Sub>{`Chart ${DOT} hover or tap a data point`}</Sub>
      <ChartTooltip stemHeight={12} testID="tooltip-chart">
        <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{`Sat, 17 Oct\n${R}2,890 ${DOT} PVR + dinner`}</Text>
      </ChartTooltip>
    </GalleryCard>
  );
}

export function LongPressCard(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <GalleryCard title="LONG-PRESS" caption="Every long-press gives a light haptic and a 2% lift. Nothing destructive lives only behind a long-press.">
      <Sub>On a Home section</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.field, paddingVertical: 8 }}>
        <MenuItem icon="dashboard_customize" label="Arrange home" />
        <MenuItem icon="visibility_off" label="Hide this section" />
        <MenuItem icon="open_in_new" label="Open Goals" />
      </View>
      <Sub>On an amount, copy</Sub>
      <Text
        testID="long-press-amount"
        onLongPress={() => setCopied(true)}
        accessibilityHint="Long press to copy"
        style={[typography.headlineSmall, { color: colors.onSurface, paddingVertical: 8 }]}
      >{`${R}18,22,350`}</Text>
      {copied ? (
        <View testID="copied-snackbar" style={{ backgroundColor: colors.inverseSurface, borderRadius: shapes.field, padding: 12, flexDirection: 'row', gap: 8 }}>
          <Glyph name="content_copy" size={18} color={colors.inverseOnSurface} />
          <Text style={[typography.bodyMedium, { color: colors.inverseOnSurface }]}>{`Copied ${R}18,22,350`}</Text>
        </View>
      ) : null}
      <Sub>On a category icon, peek</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Glyph name="local_cafe" size={24} color={colors.onSurface} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>Tea & coffee</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`38 entries ${DOT} ${R}2,140 this month`}</Text>
        </View>
        <Text style={[typography.labelLarge, { color: colors.primary }]}>Rename</Text>
        <Text style={[typography.labelLarge, { color: colors.primary }]}>Merge</Text>
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
    <GalleryCard title="GESTURES" caption="Reorder: long-press the handle. Swipe threshold 40% of the width; past it the background icon scales 1.0 to 1.2.">
      <Sub>Drag to reorder, lifted card and drop line</Sub>
      {row('This month')}
      <View style={{ height: 2, backgroundColor: colors.primary }} />
      {row('Coming up', <Glyph name="check" size={20} color={colors.primary} />)}
      {row('Goals')}
      <Sub>Pull to refresh, fund prices</Sub>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Glyph name="refresh" size={24} color={colors.primary} />
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>Release to update NAVs from AMFI</Text>
      </View>
      <Sub>Swipe a review card</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryContainer, borderRadius: shapes.card, overflow: 'hidden' }}>
        <View style={{ padding: 16 }}>
          <Glyph name="check" size={22} color={colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surfaceContainer, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Glyph name="restaurant" size={22} color={colors.onSurface} />
          <View>
            <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{`Swiggy ${DOT} ${R}486`}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>From SMS</Text>
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
    <GalleryCard title="SHEETS & MENUS" caption="ModalBottomSheet with drag handle. Menus are dropdown menus with section labels.">
      <Sub>Action sheet, from screenshot</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet, padding: 20, gap: 4 }}>
        <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, marginBottom: 12 }} />
        <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 8 }]}>Add from a screenshot</Text>
        {act('photo_library', 'Choose from gallery', 'Recent screenshots first')}
        {act('photo_camera', 'Take a photo', 'Of a bill or receipt')}
        {act('content_paste', 'Paste image', 'From clipboard')}
        {act('share', 'Share into Bacchat', "From any app's share menu")}
      </View>
      <Sub>Overflow menu, with sections</Sub>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.field, paddingVertical: 8, alignSelf: 'flex-start', minWidth: 220 }}>
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingVertical: 4 }]}>SORT</Text>
        <MenuItem icon="check" label="Newest first" />
        <MenuItem icon="sort" label="Biggest first" />
        <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: 4 }} />
        <MenuItem icon="ios_share" label="Export October" />
        <MenuItem icon="visibility_off" label="Hide amounts" />
      </View>
    </GalleryCard>
  );
}
