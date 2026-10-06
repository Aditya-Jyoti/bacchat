/** k23: You (profile hub). Header with gear, profile, stats, Backed up card, grouped rows. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenScaffold } from '../../components';
import { formatRupees } from '../../lib/format';
import { useNow, useProfile } from '../../services';
import { useTheme } from '../../theme';
import { Glyph } from './parts/Glyph';
import { GroupCaption, YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';
import { useBudget } from './budgetStore';
import { grouped, monthsSince, profileLine, useBackupCard, useYouCounts } from './useYouData';
import { t } from '../../lib/i18n';

export default function K23_You(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const { go } = useKidNav();
  const counts = useYouCounts();
  const now = useNow();
  const budgetTotal = useBudget((b) => b.totalPaise);
  const backup = useBackupCard();
  const profile = useProfile();
  const stats = [
    { value: counts ? String(monthsSince(counts.firstAt, now)) : '', labelKey: 'youUi.statMonths' },
    { value: counts ? grouped(counts.entries) : '', labelKey: 'youUi.statEntries' },
    { value: counts ? String(counts.goalsReached) : '', labelKey: 'youUi.statGoals' },
  ];
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
          <Text style={{ fontFamily: 'YoungSerif_400Regular', fontSize: 30, color: colors.onPrimaryContainer }}>{profile.initial || t('homeLive.initialFallback')}</Text>
          <Pressable
            testID="you-edit-profile"
            accessibilityRole="button"
            accessibilityLabel={t('youUi.editProfile')}
            onPress={() => go('k24')}
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
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>{profile.fullName || t('youUi.nameEmpty')}</Text>
          <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{profileLine(counts)}</Text>
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
        {stats.map((s, i) => (
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
        accessibilityLabel={t('youUi.backedUpLabel', { title: backup.title })}
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
          <Glyph name={backup.icon} size={20} color={colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelLarge, { fontSize: 15, color: colors.onSurface }]}>{backup.title}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{backup.subtitle}</Text>
        </View>
        <Glyph name="chevron_right" color={colors.onSurface} />
      </Pressable>
      <GroupCaption>{t('youUi.yourMoney')}</GroupCaption>
      <YouRow testID="you-row-accounts" icon="account_balance" title={t('youUi.accountsUpi')} subtitle={counts ? t('youUi.accountsSub', { accounts: counts.accounts, cards: counts.cards, upi: counts.upiIds }) : undefined} onPress={() => go('k10')} />
      <YouRow icon="category" title={t('youUi.categories')} subtitle={t('youUi.categoriesSub')} onPress={() => undefined} />
      <YouRow testID="you-row-budgets" icon="account_balance_wallet" title={t('youUi.budgets')} subtitle={t('youUi.budgetsSub', { amount: formatRupees(budgetTotal) })} onPress={() => go('k15')} />
      <YouRow testID="you-row-recurring" icon="event_repeat" title={t('youUi.recurring')} subtitle={counts ? t('youUi.recurringSub', { n: counts.recurring }) : undefined} onPress={() => go('k17')} />
      <GroupCaption>{t('youUi.bacchat')}</GroupCaption>
      <YouRow testID="you-row-ask" icon="auto_awesome" title={t('youUi.askBacchat')} subtitle={t('youUi.yourKey')} onPress={() => go('k18')} />
      <YouRow testID="you-row-arrange" icon="dashboard_customize" title={t('youUi.arrangeHome')} onPress={() => go('k2')} />
      <YouRow testID="you-row-settings" icon="settings" title={t('youUi.settings')} onPress={() => go('k24')} />
      <YouRow icon="volunteer_activism" title={t('youUi.about')} subtitle={t('youUi.aboutSub')} onPress={() => undefined} />
    </ScreenScaffold>
  );
}
