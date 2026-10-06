/** k23: You (profile hub). Header with gear, profile, stats, Backed up card, grouped rows. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenScaffold } from '../../components';
import { useTheme } from '../../theme';
import { Glyph } from './parts/Glyph';
import { GroupCaption, YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';
import { t } from '../../lib/i18n';

const STATS = [
  { value: '8', labelKey: 'youUi.statMonths' },
  { value: '1,284', labelKey: 'youUi.statEntries' },
  { value: '2', labelKey: 'youUi.statGoals' },
];

export default function K23_You(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const { go } = useKidNav();
  return (
    <ScreenScaffold testID="screen-k23" edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', height: 48, alignItems: 'center' }}>
        <Pressable
          testID="you-gear"
          accessibilityRole="button"
          accessibilityLabel={t('youUi.settings')}
          onPress={() => go('k24')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="settings" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'YoungSerif_400Regular', fontSize: 30, color: colors.onPrimaryContainer }}>R</Text>
          <View
            accessibilityLabel={t('youUi.editProfile')}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.surfaceContainer,
              borderWidth: 2,
              borderColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="edit" size={16} color={colors.onSurface} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>{t('youUi.name')}</Text>
          <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('youUi.since')}</Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          marginTop: 18,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.outlineVariant,
        }}
      >
        {STATS.map((s, i) => (
          <View
            key={s.labelKey}
            testID={`you-stat-${i}`}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingLeft: i === 0 ? 0 : 12,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: colors.outlineVariant,
            }}
          >
            <Text style={{ fontFamily: 'YoungSerif_400Regular', fontSize: 22, color: colors.onSurface }}>{s.value}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t(s.labelKey)}</Text>
          </View>
        ))}
      </View>
      <Pressable
        testID="you-backup-card"
        accessibilityRole="button"
        accessibilityLabel={t('youUi.backedUpLabel')}
        onPress={() => go('k25')}
        style={{
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: shapes.card,
          backgroundColor: colors.surfaceContainer,
        }}
      >
        <View
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="cloud_done" size={20} color={colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelLarge, { fontSize: 15, color: colors.onSurface }]}>{t('youUi.backedUp')}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('youUi.encryptedFirst')}</Text>
        </View>
        <Glyph name="chevron_right" color={colors.onSurface} />
      </Pressable>
      <GroupCaption>{t('youUi.yourMoney')}</GroupCaption>
      <YouRow testID="you-row-accounts" icon="account_balance" title={t('youUi.accountsUpi')} subtitle={t('youUi.accountsSub')} onPress={() => go('k10')} />
      <YouRow icon="category" title={t('youUi.categories')} subtitle={t('youUi.categoriesSub')} onPress={() => undefined} />
      <YouRow testID="you-row-budgets" icon="account_balance_wallet" title={t('youUi.budgets')} subtitle={t('youUi.budgetsSub')} onPress={() => go('k15')} />
      <YouRow testID="you-row-recurring" icon="event_repeat" title={t('youUi.recurring')} subtitle={t('youUi.recurringSub')} onPress={() => go('k17')} />
      <GroupCaption>{t('youUi.bacchat')}</GroupCaption>
      <YouRow testID="you-row-ask" icon="auto_awesome" title={t('youUi.askBacchat')} subtitle={t('youUi.yourKey')} onPress={() => go('k18')} />
      <YouRow testID="you-row-arrange" icon="dashboard_customize" title={t('youUi.arrangeHome')} onPress={() => go('k2')} />
      <YouRow testID="you-row-settings" icon="settings" title={t('youUi.settings')} onPress={() => go('k24')} />
      <YouRow icon="volunteer_activism" title={t('youUi.about')} subtitle={t('youUi.aboutSub')} onPress={() => undefined} />
    </ScreenScaffold>
  );
}
