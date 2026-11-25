import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { ledger } from '../../../data/db/queries/balances';
import { t } from '../../../lib/i18n';
import { useDbQuery, type QueryResult } from '../../../services';
import { useTheme } from '../../../theme';
import { dayMonth } from '../../you/parts/monthName';
import type { StoryAction, StoryLine } from './story';

export type MoneyCheck = { bill: { cardName: string; leftPaise: number; dueLabel: string } | null; freePaise: number };

/** The next card bill still to pay, and what bank and cash accounts hold outside goals. */
export function useMoneyCheck(): QueryResult<MoneyCheck> {
  return useDbQuery(async (db, now) => {
    const [{ accounts, debts }, allocations] = await Promise.all([ledger(db, now), db.allocations.list()]);
    const byId = new Map(accounts.map((a) => [a.id, a] as const));
    const due = debts
      .filter((d) => d.cycle && d.cycle.billLeftPaise > 0)
      .sort((a, b) => (a.cycle?.billDueAt ?? 0) - (b.cycle?.billDueAt ?? 0))[0];
    const liquid = accounts.filter((a) => !a.deletedAt && (a.kind === 'bank' || a.kind === 'cash'));
    const liquidIds = new Set(liquid.map((a) => a.id));
    const inGoals = allocations.filter((a) => a.accountId && liquidIds.has(a.accountId)).reduce((s, a) => s + Math.max(0, a.amountPaise), 0);
    const freePaise = Math.max(0, liquid.reduce((s, a) => s + a.balancePaise, 0) - inGoals);
    return {
      bill: due?.cycle ? { cardName: byId.get(due.accountId)?.name ?? '', leftPaise: due.cycle.billLeftPaise, dueLabel: dayMonth(due.cycle.billDueAt) } : null,
      freePaise,
    };
  });
}

/**
 * The plain-words card: each line has an outline icon in a tinted circle and, where there is a next
 * step, a small text button. A grouped surface (one of the few cards on the screen), no elevation.
 */
export function MonthStory({ lines, onAction, testID = 'month-story' }: { lines: StoryLine[]; onAction: (a: StoryAction) => void; testID?: string }): React.JSX.Element | null {
  const { colors, typography, spacing, shapes } = useTheme();
  if (lines.length === 0) return null;
  return (
    <View testID={testID} style={{ marginTop: spacing.lg, padding: spacing.lg, borderRadius: shapes.card, backgroundColor: colors.surfaceContainer, gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>
        {t('moneyLive.storyTitle')}
      </Text>
      {lines.map((l) => (
        <View key={l.key} testID={`story-${l.key}`} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name={l.icon} size={18} color={colors.onSecondaryContainer} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{l.text}</Text>
            {l.action && l.actionLabel ? (
              <Pressable
                testID={`story-action-${l.key}`}
                accessibilityRole="button"
                onPress={() => l.action && onAction(l.action)}
                hitSlop={8}
                style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
              >
                <Text style={[typography.labelLarge, { color: colors.primary }]}>{l.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
