/** k23: You (profile hub). Header with gear, profile, stats, Backed up card, grouped rows. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenScaffold } from '../../components';
import { useTheme } from '../../theme';
import { Glyph } from './parts/Glyph';
import { GroupCaption, YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';

const R = '\u20B9';
const DOT = '\u00B7';
const STATS = [
  { value: '8', label: 'months' },
  { value: '1,284', label: 'entries' },
  { value: '2', label: 'goals reached' },
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
          accessibilityLabel="Settings"
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
            accessibilityLabel="Edit profile"
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
          <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>Rahul Sharma</Text>
          <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>Keeping the khata since March</Text>
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
            key={s.label}
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
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Pressable
        testID="you-backup-card"
        accessibilityRole="button"
        accessibilityLabel="Backed up 2 min ago. Open backup and sync"
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
          <Text style={[typography.labelLarge, { fontSize: 15, color: colors.onSurface }]}>Backed up 2 min ago</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`Encrypted on this phone first ${DOT} Google Drive`}</Text>
        </View>
        <Glyph name="chevron_right" color={colors.onSurface} />
      </Pressable>
      <GroupCaption>YOUR MONEY</GroupCaption>
      <YouRow testID="you-row-accounts" icon="account_balance" title="Accounts & UPI IDs" subtitle={`5 accounts ${DOT} 2 cards ${DOT} 3 UPI IDs`} onPress={() => go('k10')} />
      <YouRow icon="category" title="Categories" subtitle={`184 icons ${DOT} 12 custom`} onPress={() => undefined} />
      <YouRow testID="you-row-budgets" icon="account_balance_wallet" title="Budgets" subtitle={`${R}45,000 / month`} onPress={() => go('k15')} />
      <YouRow testID="you-row-recurring" icon="event_repeat" title="Recurring & SIPs" subtitle="9 active" onPress={() => go('k17')} />
      <GroupCaption>BACCHAT</GroupCaption>
      <YouRow testID="you-row-ask" icon="auto_awesome" title="Ask Bacchat" subtitle={`Your key ${DOT} Claude`} onPress={() => go('k18')} />
      <YouRow testID="you-row-arrange" icon="dashboard_customize" title="Arrange home" onPress={() => go('k2')} />
      <YouRow testID="you-row-settings" icon="settings" title="Settings" onPress={() => go('k24')} />
      <YouRow icon="volunteer_activism" title="About & source code" subtitle={`v1.0 ${DOT} GPL-3.0`} onPress={() => undefined} />
    </ScreenScaffold>
  );
}
