/** k12: Goals (tab root). Set aside so far, Active / Done, goal rows, insight line, New goal FAB. */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Glyph } from '../../components/Glyph';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { SegmentedChoice } from '../../components/SegmentedChoice';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { GoalRow } from './sections/GoalRow';
import { isReached } from './goalTypes';
import { EmptyGoals } from '../../components/illustrations';
import { dueInsight } from './sections/dueInsight';
import { useGoalsData } from './useGoalsData';
import { t } from '../../lib/i18n';

export default function K12_Goals(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const nav = useScreenNav();
  const { goals, loading, spendAccounts, free, now } = useGoalsData();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const active = goals.filter((g) => !isReached(g));
  const done = goals.filter(isReached);
  const shown = tab === 'active' ? active : done;
  const total = active.reduce((a, g) => a + g.savedPaise, 0);
  const insight = dueInsight(goals, spendAccounts, free, now);
  const insightText = insight
    ? t(insight.days <= 0 ? 'goalsUi.dueInsightToday' : insight.days === 1 ? 'goalsUi.dueInsightOne' : 'goalsUi.dueInsight', {
        name: insight.name,
        amount: formatRupees(insight.remainingPaise),
        days: insight.days,
        account: insight.account,
      })
    : null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenScaffold testID="screen-k12" contentStyle={{ paddingBottom: 96 }}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={[typography.headlineSmall, { color: colors.onSurface }]}>{t('goalsUi.title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('goalsUi.moreOptions')}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Glyph name="more_vert" color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={[typography.bodySmall, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('goalsUi.setAsideSoFar')}</Text>
        <Text testID="goals-total" style={[typography.headlineSmall, { fontSize: 30, lineHeight: 35, color: colors.onSurface }]}>
          {formatRupees(total)}
        </Text>
        <View style={{ marginTop: 14 }}>
          <SegmentedChoice
            testID="goals-tab"
            accessibilityLabel={t('goalsUi.statusLabel')}
            value={tab}
            onChange={setTab}
            options={[
              { id: 'active', label: t('goalsUi.active', { n: active.length }) },
              { id: 'done', label: t('goalsUi.done', { n: done.length }) },
            ]}
          />
        </View>
        <View style={{ marginTop: 6 }}>
          {loading ? (
            <SkeletonRows count={4} />
          ) : (
            shown.map((g) => <GoalRow key={g.id} goal={g} onPress={() => nav.go('k13', { id: g.id })} />)
          )}
          {!loading && shown.length === 0 ? (
            <View style={{ paddingTop: 12 }}>
              <EmptyGoals height={120} />
              <Text testID="goals-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingVertical: 16 }]}>
                {t('goalsUi.noGoals')}
              </Text>
            </View>
          ) : null}
        </View>
        {tab === 'active' && insightText ? (
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              gap: 10,
              padding: 14,
              paddingVertical: 12,
              borderRadius: shapes.card,
              backgroundColor: colors.tertiaryContainer,
            }}
          >
            <Glyph name="auto_awesome" size={18} color={colors.onTertiaryContainer} />
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onTertiaryContainer }]}>
              {insightText}
            </Text>
          </View>
        ) : null}
      </ScreenScaffold>
      <Pressable
        testID="new-goal"
        accessibilityRole="button"
        accessibilityLabel={t('goalsUi.newGoal')}
        onPress={() => nav.go('k14')}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          height: 56,
          paddingLeft: 16,
          paddingRight: 20,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.primaryContainer,
          elevation: 3,
          shadowColor: colors.scrim,
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Glyph name="add" color={colors.onPrimaryContainer} />
        <Text style={[typography.labelLarge, { color: colors.onPrimaryContainer }]}>New goal</Text>
      </Pressable>
    </View>
  );
}
