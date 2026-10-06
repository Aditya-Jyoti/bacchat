/**
 * k9: Resolve conflict bottom sheet. Email and screenshot evidence side by side, three radio
 * options (conflictOptions), a "Use ..." button and an optional local trust rule. The result goes
 * back to k8 as route params { conflict, trust }. Route param choice preselects an option.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { conflictOptions, sourceIcon, sourceName, type ConflictOption } from '../../data';
import { formatRupees, formatTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme';
import { useImportSession } from './parts/importSession';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { Icon, PillButton, useSerif } from './parts/ui';

type Choice = ConflictOption['id'];
const USE_LABEL: Record<Choice, string> = { shot: 'screenshot amount', mail: 'email amount', both: 'both' };

function Evidence({ icon, source, amount, time, raw }: { icon: string; source: string; amount: string; time: string; raw: string }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const serif = useSerif();
  return (
    <View
      testID={`evidence-${source}`}
      accessible
      accessibilityLabel={`${source}, ${amount}, ${time}, ${raw}`}
      style={{ flex: 1, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: shapes.card, padding: 12, backgroundColor: colors.surface }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{source}</Text>
      </View>
      <Text style={[serif(24), { color: colors.onSurface, marginTop: 6 }]}>{amount}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{time}</Text>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 8, fontSize: 10, lineHeight: 15 }]}>{raw}</Text>
    </View>
  );
}

export default function K9_ResolveConflict(): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const session = useImportSession();
  // The conflict k8 opened: the saved entry and the screenshot row. Without a session it shows the design's Amazon example.
  const item = session.plan && session.active !== null ? session.plan.plan.items[session.active] : null;
  const saved = item?.againstId ? session.plan?.against[item.againstId] : undefined;
  const live = item && saved ? { item, saved } : null;
  const merchant = live ? live.item.row.merchant : 'Amazon';
  const savedAmount = live ? formatRupees(live.saved.amountPaise) : '\u20B91,299';
  const shotAmount = live ? formatRupees(live.item.row.amountPaise) : '\u20B91,249';
  const savedKind = live ? (live.saved.sources[0]?.kind ?? 'hand') : 'mail';
  const gap = live ? Math.abs(live.saved.amountPaise - live.item.row.amountPaise) : 5000;
  const minutes = live ? Math.round(Math.abs(live.saved.at - live.item.row.at) / 60000) : 1;
  const useLabel: Record<Choice, string> = { ...USE_LABEL, mail: live ? `${sourceName[savedKind].toLowerCase()} amount` : USE_LABEL.mail };
  const titleOf = (o: ConflictOption): string =>
    !live ? o.title : o.id === 'shot' ? fmt(t('moneyLive.keepShot'), { amount: shotAmount }) : o.id === 'mail' ? fmt(t('moneyLive.keepSaved'), { amount: savedAmount, source: sourceName[savedKind] }) : o.title;
  const initial = conflictOptions.find((o) => o.id === nav.params.choice)?.id ?? 'shot';
  const [choice, setChoice] = useState<Choice>(initial);
  const [trust, setTrust] = useState(true);
  const [resolved, setResolved] = useState(false);
  const use = (): void => {
    setResolved(true);
    if (session.active !== null) session.resolve(session.active, choice, trust && choice === 'shot');
    nav.returnTo('k8', { conflict: choice, trust: trust && choice !== 'both' });
  };
  return (
    <View testID="screen-k9" style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={S.close} onPress={() => nav.back('k8')} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim }} />
      <View
        accessibilityViewIsModal
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 96, backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet }}
      >
        <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, alignSelf: 'center', marginTop: spacing.md }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
          <Text accessibilityRole="header" style={[serif(22), { color: colors.onSurface }]}>{live ? fmt(t('moneyLive.conflictTitleFor'), { name: merchant }) : S.conflictTitle}</Text>
          <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 4 }]}>
            {live ? fmt(t('moneyLive.conflictSubLive'), { amount: formatRupees(gap), minutes }) : S.conflictSub}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Evidence
              icon={live ? sourceIcon[savedKind] : 'mail'}
              source={live ? sourceName[savedKind] : 'Email'}
              amount={savedAmount}
              time={live ? formatTime(live.saved.at) : '3:11 pm'}
              raw={live ? live.saved.merchant : S.emailEvidence}
            />
            <Evidence
              icon="screenshot_region"
              source="Screenshot"
              amount={shotAmount}
              time={live ? (live.item.row.timeKnown ? formatTime(live.item.row.at) : '') : '3:12 pm'}
              raw={live ? live.item.row.lines.join(' ') : S.shotEvidence}
            />
          </View>
          <View accessibilityRole="radiogroup" style={{ gap: spacing.sm, marginTop: 14 }}>
            {conflictOptions.map((o) => {
              const on = o.id === choice;
              return (
                <Pressable
                  key={o.id}
                  testID={`option-${o.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${titleOf(o)}. ${o.subtitle}`}
                  onPress={() => setChoice(o.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: 56,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.primary : colors.outlineVariant,
                    backgroundColor: on ? colors.surfaceContainerLowest : 'transparent',
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.primary : colors.outline, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? colors.primary : 'transparent' }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{titleOf(o)}</Text>
                    <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{o.subtitle}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            testID="trust-rule"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: trust }}
            onPress={() => setTrust((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, marginTop: 6 }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: trust ? colors.primary : 'transparent', borderWidth: trust ? 0 : 2, borderColor: colors.outline }}>
              {trust ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
            </View>
            <Text style={[typography.bodyMedium, { color: colors.onSurface, flex: 1 }]}>{live ? fmt(t('moneyLive.trustRuleFor'), { name: merchant }) : S.trustRule}</Text>
          </Pressable>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
          {resolved ? (
            <PillButton testID="use-button" label={fmt(S.sorted, { label: useLabel[choice] })} kind="container" icon="check_circle" height={52} style={{ width: '100%' }} />
          ) : (
            <PillButton testID="use-button" label={fmt(S.use, { label: useLabel[choice] })} height={52} onPress={use} style={{ width: '100%' }} />
          )}
        </View>
      </View>
    </View>
  );
}
