/** k10: Accounts. Net worth, then your bank and cash accounts, investments, and cards and loans (debt always shown on its own). */
import React from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { Button } from 'react-native-paper';

import { SkeletonRows } from '../../components/SkeletonLoader';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { AccountRow } from './sections/AccountRow';
import { GroupHeader } from './sections/GroupHeader';
import { useAccountsData } from './useAccountsData';
import { t } from '../../lib/i18n';
import { EmptyAccounts } from '../../components/illustrations';

export default function K10_Accounts(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const d = useAccountsData();
  const banks = d.own.filter((a) => a.kind === 'bank' || a.kind === 'cash');
  const investments = d.own.filter((a) => a.kind === 'mf' || a.kind === 'nps');
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
      {d.loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <GroupHeader title={t('accountsUi.groupBanks')} total={formatRupees(banks.reduce((s, a) => s + a.paise, 0))} />
          {d.own.length === 0 ? (
            <View>
              <EmptyAccounts height={110} />
              <Text testID="accounts-empty" style={[muted, { paddingVertical: 12 }]}>{t('accountsUi.noAccounts')}</Text>
              <Button testID="accounts-empty-add" mode="contained-tonal" icon="plus" onPress={() => nav.go('k11')} contentStyle={{ height: 48 }}>
                {t('youUi.addAccount')}
              </Button>
            </View>
          ) : null}
          {banks.map((a) => (
            <AccountRow key={a.id} name={a.name} kind={a.kindText} icon={a.icon} amount={formatRupees(a.paise)} onPress={() => nav.go('k11', { id: a.id })} />
          ))}
          {investments.length > 0 ? (
            <>
              <GroupHeader title={t('accountsUi.groupInvest')} total={formatRupees(investments.reduce((s, a) => s + a.paise, 0))} />
              {investments.map((a) => (
                <AccountRow key={a.id} name={a.name} kind={a.kindText} icon={a.icon} amount={formatRupees(a.paise)} onPress={() => nav.go('k11', { id: a.id })} />
              ))}
            </>
          ) : null}
          {d.owe.length > 0 ? (
            <>
              <GroupHeader title={t('accountsUi.groupOwe')} total={formatRupees(d.owePaise)} />
              {d.owe.map((o) => (
                <AccountRow
                  key={o.id}
                  onPress={() => nav.go('k11', { id: o.accountId })}
                  name={o.name}
                  kind={o.kindText}
                  icon={o.icon}
                  amount={formatRupees(o.paise)}
                  owe={{ used: `${o.usedPct}%`, limitText: t('accountsUi.limitSuffix', { amount: formatRupees(o.limitPaise) }) }}
                />
              ))}
            </>
          ) : null}
        </>
      )}
    </StackScreen>
  );
}
