/** k2: Arrange home. Drag handles reorder, switches hide, Net worth stays pinned. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { ReorderableList } from '../../components/ReorderableList';
import { sectionMeta, useHomeConfig, type HomeSectionConfig } from '../../data';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { t } from '../../lib/i18n';

const ROW = 60;

export default function K2_ArrangeHome(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const { back } = useGo();
  const { config, move, setEnabled, reset } = useHomeConfig();
  const hidden = config.filter((s) => !s.enabled).length;
  const rule = { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant } as const;

  return (
    <SafeAreaView testID="screen-k2" edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('homeUi.close')}
          onPress={back}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text accessibilityRole="header" style={[typography.titleMedium, { flex: 1, fontSize: 20, color: colors.onSurface }]}>
          {t('homeUi.arrangeTitle')}
        </Text>
        <Button mode="contained" onPress={back} contentStyle={{ height: 40, paddingHorizontal: 4 }}>
          {t('homeUi.done')}
        </Button>
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenMargin, paddingTop: 4 }}>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginBottom: 14, lineHeight: 21 }]}>
          {t('homeUi.arrangeIntro')}
        </Text>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, rule]}>
          <View style={{ width: 32, alignItems: 'center' }}>
            <Glyph name="push_pin" size={20} color={colors.onSurfaceVariant} />
          </View>
          <View
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
          >
            <Glyph name="show_chart" size={20} color={colors.onPrimaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyLarge, { fontWeight: '600', color: colors.onSurface }]}>{t('homeUi.netWorth')}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('homeUi.alwaysFirst')}</Text>
          </View>
        </View>
        <ReorderableList<HomeSectionConfig>
          data={config}
          keyExtractor={(s) => s.id}
          itemHeight={ROW}
          onMove={move}
          getLabel={(s) => sectionMeta[s.id].label}
          renderItem={({ item, handle }) => {
            const meta = sectionMeta[item.id];
            return (
              <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface }, rule]}>
                {handle}
                <View style={{ opacity: item.enabled ? 1 : 0.45, flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Glyph name={meta.icon} size={20} color={colors.onSecondaryContainer} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.bodyLarge, { fontWeight: '600', color: colors.onSurface }]}>{meta.label}</Text>
                    <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                      {meta.desc}
                    </Text>
                  </View>
                </View>
                <Switch
                  testID={`switch-${item.id}`}
                  accessibilityLabel={t('homeUi.showSection', { name: meta.label })}
                  value={item.enabled}
                  onValueChange={(v) => setEnabled(item.id, v)}
                />
              </View>
            );
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('homeUi.hiddenCount', { n: hidden })}</Text>
          <Pressable accessibilityRole="button" onPress={reset} style={{ minHeight: spacing.touchTarget, justifyContent: 'center' }}>
            <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('homeUi.resetDefault')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
