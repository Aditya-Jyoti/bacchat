/** k10: Accounts. Net worth equation, "Yours to spend", what you own, what you owe, UPI IDs. */
import React from 'react';
import { Text, type TextStyle } from 'react-native';

import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { netWorth, own, owe, upi } from '../../data';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { AccountRow } from './sections/AccountRow';
import { GroupHeader } from './sections/GroupHeader';
import { UpiRow } from './sections/UpiRow';
import { YoursToSpend } from './sections/YoursToSpend';
import { t } from '../../lib/i18n';

export default function K10_Accounts(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const cashAndBanks = own.filter((a) => a.icon === 'account_balance' || a.icon === 'payments').reduce((s, a) => s + a.amount.paise, 0);
  const dues = owe.reduce((s, d) => s + d.amount.paise, 0);
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
        {netWorth.net.text}
      </Text>
      <Text testID="net-equation" style={[muted, { marginTop: 4 }]}>
        {t('youUi.equation', { own: netWorth.own.text, owe: netWorth.owe.text })}
      </Text>
      <YoursToSpend banksPaise={cashAndBanks} duesPaise={dues} />
      <GroupHeader title={t('youUi.whatOwn')} total={netWorth.own.text} />
      {own.map((a) => (
        <AccountRow key={a.name} name={a.name} kind={a.kind} icon={a.icon} amount={a.amount.text} />
      ))}
      <GroupHeader title={t('youUi.whatOwe')} total={netWorth.owe.text} />
      {owe.map((d) => (
        <AccountRow
          key={d.name}
          name={d.name}
          kind={d.kind}
          icon={d.icon}
          amount={d.amount.text}
          owe={{ used: d.used, limitText: d.limitText }}
        />
      ))}
      <GroupHeader title={t('youUi.upiIds')} />
      {upi.map((u) => (
        <UpiRow key={u.id} item={u} />
      ))}
    </StackScreen>
  );
}
