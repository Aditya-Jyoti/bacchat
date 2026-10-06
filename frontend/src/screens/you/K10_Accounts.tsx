/** k10: Accounts. Net worth equation, "Yours to spend", what you own, what you owe, UPI IDs. */
import React from 'react';
import { Text, type TextStyle } from 'react-native';

import { SkeletonRows } from '../../components/SkeletonLoader';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { AccountRow } from './sections/AccountRow';
import { GroupHeader } from './sections/GroupHeader';
import { UpiRow } from './sections/UpiRow';
import { YoursToSpend } from './sections/YoursToSpend';
import { useAccountsData } from './useAccountsData';
import { t } from '../../lib/i18n';

export default function K10_Accounts(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const d = useAccountsData();
  const muted: TextStyle = { ...typography.bodyMedium, fontSize: 13, color: colors.onSurfaceVariant };
  return (
    <StackScreen
      testID="screen-k10"
      title={t('youUi.accounts')}
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="add" label={t('youUi.addAccount')} testID="add-account" onPress={() => nav.go('k11')} />}
    >
      <Text style={muted}>{t('youUi.netWorth')}</Text>
      <Text testID="net-worth" style={[typography.headlineSmall, { fontSize: 32, lineHeight: 35, color: colors.onSurface }]}>
        {formatRupees(d.netPaise)}
      </Text>
      <Text testID="net-equation" style={[muted, { marginTop: 4 }]}>
        {t('youUi.equation', { own: formatRupees(d.ownPaise), owe: formatRupees(d.owePaise) })}
      </Text>
      {d.loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <YoursToSpend banksPaise={d.banksPaise} duesPaise={d.duesPaise} />
          <GroupHeader title={t('youUi.whatOwn')} total={formatRupees(d.ownPaise)} />
          {d.own.length === 0 ? (
            <Text testID="accounts-empty" style={[muted, { paddingVertical: 12 }]}>{t('accountsUi.noAccounts')}</Text>
          ) : null}
          {d.own.map((a) => (
            <AccountRow key={a.id} name={a.name} kind={a.kindText} icon={a.icon} amount={formatRupees(a.paise)} />
          ))}
          <GroupHeader title={t('youUi.whatOwe')} total={formatRupees(d.owePaise)} />
          {d.owe.map((o) => (
            <AccountRow
              key={o.id}
              name={o.name}
              kind={o.kindText}
              icon={o.icon}
              amount={formatRupees(o.paise)}
              owe={{ used: `${o.usedPct}%`, limitText: t('accountsUi.limitSuffix', { amount: formatRupees(o.limitPaise) }) }}
            />
          ))}
          <GroupHeader title={t('youUi.upiIds')} />
          {d.upi.map((u) => (
            <UpiRow key={u.id} item={u} />
          ))}
        </>
      )}
    </StackScreen>
  );
}
