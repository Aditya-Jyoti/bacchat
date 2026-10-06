/**
 * Messages that look like an entry you already have, one at a time, in the k9 style: the saved entry
 * and the message side by side, two plain choices, a pill button. A bottom sheet over its parent;
 * dismiss returns to it. Nothing is added until you pick.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { sourceIcon, sourceName } from '../../../data';
import { formatRupees, formatTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import type { PendingChoice } from '../../../services/ingestPending';
import { useTheme } from '../../../theme';
import { Icon, PillButton, useSerif } from '../parts/ui';
import { usePendingConflicts, type PendingView } from './usePendingConflicts';

function Evidence({ testID, icon, source, amount, time, name }: { testID: string; icon: string; source: string; amount: string; time: string; name: string }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const serif = useSerif();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${source}, ${amount}, ${time}, ${name}`}
      style={{ flex: 1, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: shapes.card, padding: 12, backgroundColor: colors.surface }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>{source}</Text>
      </View>
      <Text style={[serif(24), { color: colors.onSurface, marginTop: 6 }]}>{amount}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{time}</Text>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 8 }]}>{name}</Text>
    </View>
  );
}

const OPTIONS: { id: PendingChoice; title: string; help: string }[] = [
  { id: 'keepExisting', title: 'moreUi.pendingKeepExisting', help: 'moreUi.pendingKeepExistingHelp' },
  { id: 'keepBoth', title: 'moreUi.pendingKeepBoth', help: 'moreUi.pendingKeepBothHelp' },
];

function Card({ view, onPick }: { view: PendingView; onPick: (c: PendingChoice) => void }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const [choice, setChoice] = useState<PendingChoice>('keepExisting');
  const { item, existing } = view;
  const c = item.candidate;
  const savedKind = existing?.sources[0]?.kind ?? 'hand';
  const merchant = c.merchant ?? t('moreUi.pendingUnknownPayee');
  return (
    <View testID={`pending-${item.id}`}>
      <Text accessibilityRole="header" style={[serif(22), { color: colors.onSurface }]}>{t('moreUi.pendingTitle')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {existing ? (
          <Evidence
            testID={`pending-existing-${item.id}`}
            icon={sourceIcon[savedKind]}
            source={t('moreUi.pendingYouHave')}
            amount={formatRupees(existing.amountPaise)}
            time={formatTime(existing.at)}
            name={existing.merchant}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('moreUi.pendingMissing')}</Text>
          </View>
        )}
        <Evidence
          testID={`pending-message-${item.id}`}
          icon={sourceIcon[c.source]}
          source={`${t('moreUi.pendingFromMessage')} (${sourceName[c.source]})`}
          amount={formatRupees(c.amountPaise)}
          time={c.timeKnown ? formatTime(c.at) : ''}
          name={merchant}
        />
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm, marginTop: 14 }}>
        {OPTIONS.map((o) => {
          const on = o.id === choice;
          return (
            <Pressable
              key={o.id}
              testID={`pending-option-${o.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t(o.title)}. ${t(o.help)}`}
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
                <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t(o.title)}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t(o.help)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <PillButton testID={`pending-use-${item.id}`} label={t(OPTIONS.find((o) => o.id === choice)?.title ?? '')} height={52} onPress={() => onPick(choice)} style={{ width: '100%', marginTop: spacing.lg }} />
    </View>
  );
}

export function PendingConflictsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element | null {
  const { colors, typography, shapes, spacing } = useTheme();
  const { items, resolve } = usePendingConflicts();
  if (!visible) return null;
  const first = items[0];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View testID="pending-sheet" style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('moreUi.pendingBack')} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim }} />
        <View
          accessibilityViewIsModal
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 96, backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet }}
        >
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, alignSelf: 'center', marginTop: spacing.md }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
            {first ? (
              <>
                <Card key={first.item.id} view={first} onPick={(c) => void resolve(first.item.id, c)} />
                {items.length > 1 ? (
                  <Text testID="pending-more" style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: spacing.md }]}>
                    {t('ingestUi.pendingCount', { n: items.length - 1 })}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text testID="pending-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('moreUi.pendingEmpty')}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
