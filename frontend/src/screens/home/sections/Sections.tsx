import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SegmentedProgress } from '../../../components/SegmentedProgress';
import { Banner } from '../../../components/Banner';
import { budgetSummary, goals, sectionMeta, spend, spendTotal, upcoming } from '../../../data';
import { useTheme } from '../../../theme';
import { homeCopy } from '../copy';
import { HomeSection } from './HomeSection';
import { Row } from './Rows';
import type { HomeSectionId } from '../../../data/types';
import type { KId } from '../../../navigation/screenManifest';
import { t } from '../../../lib/i18n';

export type SectionsProps = { go: (kid: KId) => void; arrange: () => void };

const MAX_SPEND = 6640;

function Insight({ arrange }: SectionsProps): React.JSX.Element {
  return (
    <Pressable
      testID="section-insight"
      accessibilityActions={[{ name: 'longpress', label: t('homeUi.arrangeHome') }]}
      onAccessibilityAction={() => arrange()}
      onLongPress={arrange}
      style={{ marginTop: 18 }}
    >
      <Banner variant="insight">{homeCopy.insight}</Banner>
    </Pressable>
  );
}

function Accounts({ go, arrange }: SectionsProps): React.JSX.Element {
  const c = homeCopy;
  return (
    <HomeSection testID="section-accounts" title={sectionMeta.accounts.label} onPress={() => go('k10')} onLongPress={arrange}>
      <Row title={c.spendable.name} subtitle={c.spendable.sub} amount={c.spendable.amount} icon={c.spendable.icon} paddingVertical={9} />
      <Row title={c.dues.name} subtitle={c.dues.sub} amount={c.dues.amount} icon={c.dues.icon} neutral paddingVertical={9} />
    </HomeSection>
  );
}

function Spend({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <HomeSection
      testID="section-spend"
      title={sectionMeta.spend.label}
      trailing={`${spendTotal.text} ${homeCopy.spentSuffix}`}
      onPress={() => go('k3')}
      onLongPress={arrange}
    >
      {spend.map((s) => (
        <Row key={s.name} title={s.name} amount={s.amount.text} icon={s.icon} paddingVertical={7}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, marginTop: 6 }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.primary,
                width: `${Math.min(100, (s.amount.paise / 100 / MAX_SPEND) * 100)}%`,
              }}
            />
          </View>
        </Row>
      ))}
    </HomeSection>
  );
}

function Upcoming({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <HomeSection testID="section-upcoming" title={sectionMeta.upcoming.label} onPress={() => go('k17')} onLongPress={arrange}>
      {upcoming.slice(0, 4).map((u) => (
        <Row
          key={`${u.date}${u.month}${u.name}`}
          title={u.name}
          subtitle={`${u.kind} \u00B7 ${u.from}`}
          amount={u.amount.text}
          leading={
            <View style={{ width: 36, alignItems: 'center' }}>
              <Text style={[typography.titleMedium, { fontSize: 17, lineHeight: 17, color: colors.onSurface }]}>{u.date}</Text>
              <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{u.month}</Text>
            </View>
          }
        />
      ))}
    </HomeSection>
  );
}

function Goals({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <HomeSection testID="section-goals" title={sectionMeta.goals.label} onLongPress={arrange}>
      {goals.slice(0, 2).map((g) => (
        <Pressable
          key={g.name}
          accessibilityRole="button"
          accessibilityLabel={`${g.name}, ${g.saved.text} of ${g.target.text}`}
          onPress={() => go('k13')}
          onLongPress={arrange}
          style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{g.name}</Text>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              {g.saved.text} / {g.target.text}
            </Text>
          </View>
          <View style={{ height: 8 }} />
          <SegmentedProgress fraction={g.saved.paise / g.target.paise} height={6} />
        </Pressable>
      ))}
    </HomeSection>
  );
}

function Budget({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const c = homeCopy;
  return (
    <HomeSection
      testID="section-budget"
      title={sectionMeta.budget.label}
      trailing={c.daysLeft}
      onPress={() => go('k15')}
      onLongPress={arrange}
    >
      <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{c.budgetLeft}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${budgetSummary.spent.text} spent of ${budgetSummary.total.text}`}
        style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh, marginTop: 8 }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${c.budgetFill * 100}%` }} />
        <View
          testID="budget-today"
          style={{ position: 'absolute', left: `${c.budgetToday * 100}%`, top: -4, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.onSurface }}
        />
      </View>
    </HomeSection>
  );
}

const BY_ID: Record<HomeSectionId, (p: SectionsProps) => React.JSX.Element> = {
  insight: Insight,
  accounts: Accounts,
  spend: Spend,
  upcoming: Upcoming,
  goals: Goals,
  budget: Budget,
};

/** Renders one configurable Home section by id. */
export function renderSection(id: HomeSectionId, p: SectionsProps): React.JSX.Element {
  const C = BY_ID[id];
  return <C key={id} {...p} />;
}
