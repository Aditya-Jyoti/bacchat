/** k24: Settings. Grouped M3 list: theme segmented, switches, chevrons, Delete all data behind a dialog. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Switch } from 'react-native-paper';

import { ScreenScaffold } from '../../components';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { GroupCaption, YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';

const R = '\u20B9';
const DOT = '\u00B7';

type ThemeChoice = 'system' | 'light' | 'dark';
type SwitchId = 'wallpaper' | 'sms' | 'email' | 'upi' | 'nudges' | 'reminders' | 'lock' | 'hide';

const SWITCHES: Record<SwitchId, { icon: string; title: string; sub: string }> = {
  wallpaper: { icon: 'palette', title: 'Colours from wallpaper', sub: 'Material You dynamic colour' },
  sms: { icon: 'sms', title: 'Read bank SMS', sub: 'On this phone only. Never uploaded.' },
  email: { icon: 'mail', title: 'Read payment emails', sub: 'rahul.sharma@gmail.com' },
  upi: { icon: 'notifications_active', title: 'Read UPI app notifications', sub: 'GPay, PhonePe, Paytm' },
  nudges: { icon: 'spa', title: 'Gentle budget nudges', sub: 'At 90% of a category' },
  reminders: { icon: 'event', title: 'Bill & SIP reminders', sub: '1 day before' },
  lock: { icon: 'fingerprint', title: 'App lock', sub: 'Fingerprint or PIN' },
  hide: { icon: 'visibility_off', title: 'Hide amounts on open', sub: 'Tap to reveal' },
};

export default function K24_Settings(): React.JSX.Element {
  const { colors, typography, colorSource } = useTheme();
  const { go, back } = useKidNav();
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [on, setOn] = useState<Record<SwitchId, boolean>>({
    wallpaper: true, sms: true, email: true, upi: false, nudges: true, reminders: true, lock: true, hide: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sw = (id: SwitchId) => {
    const row = SWITCHES[id];
    const sub = id === 'wallpaper' && !on.wallpaper ? 'Using the warm Khata palette' : row.sub;
    return (
      <YouRow
        key={id}
        testID={`settings-row-${id}`}
        icon={row.icon}
        title={row.title}
        subtitle={sub}
        trailing={
          <Switch
            testID={`settings-switch-${id}`}
            value={on[id]}
            onValueChange={(v) => setOn((s) => ({ ...s, [id]: v }))}
            accessibilityLabel={row.title}
          />
        }
      />
    );
  };

  return (
    <ScreenScaffold testID="screen-k24" edges={['top', 'left', 'right']}>
      <AppBar title="Settings" onBack={back} />
      <GroupCaption>LOOK</GroupCaption>
      <View style={{ paddingTop: 4, paddingBottom: 10 }}>
        <SegmentedButtons
          value={choice}
          onValueChange={(v) => setChoice(v as ThemeChoice)}
          buttons={[
            { value: 'system', label: 'System', testID: 'theme-system', showSelectedCheck: true },
            { value: 'light', label: 'Light', testID: 'theme-light', showSelectedCheck: true },
            { value: 'dark', label: 'Dark', testID: 'theme-dark', showSelectedCheck: true },
          ]}
        />
      </View>
      {sw('wallpaper')}
      <Text testID="settings-colour-source" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 6 }]}>
        {colorSource === 'dynamic' && on.wallpaper ? 'Colours now come from your wallpaper.' : 'Colours now use the warm Khata palette.'}
      </Text>
      <YouRow icon="currency_rupee" title="Number format" subtitle={`${R}12,34,567 ${DOT} Indian`} onPress={() => undefined} />
      <GroupCaption>AUTO-ADD</GroupCaption>
      {(['sms', 'email', 'upi'] as const).map(sw)}
      <GroupCaption>NUDGES</GroupCaption>
      {(['nudges', 'reminders'] as const).map(sw)}
      <GroupCaption>PRIVACY & SECURITY</GroupCaption>
      {(['lock', 'hide'] as const).map(sw)}
      <YouRow
        testID="settings-row-backup"
        icon="cloud_sync"
        title="Backup & sync"
        subtitle={`On ${DOT} Google Drive`}
        onPress={() => go('k25')}
      />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 8 }]}>
        {`${t('privacy.onDevice')} Reading SMS and email is your choice and stays on this phone.`}
      </Text>
      <GroupCaption>DATA</GroupCaption>
      <YouRow icon="ios_share" title="Export" subtitle="CSV or JSON" onPress={() => undefined} />
      <YouRow icon="upload_file" title="Import" subtitle="From CSV, Walnut, Money Manager" onPress={() => undefined} />
      <View style={{ paddingVertical: 16 }}>
        <Button
          testID="settings-delete"
          mode="outlined"
          icon="delete"
          textColor={colors.error}
          style={{ borderColor: colors.outline }}
          contentStyle={{ height: 48 }}
          onPress={() => setConfirmDelete(true)}
        >
          Delete all data
        </Button>
      </View>
      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>Delete all data?</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              Every entry, account and goal on this phone will be removed. Backups you made stay where they are.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="settings-delete-keep" onPress={() => setConfirmDelete(false)}>Keep</Button>
            <Button testID="settings-delete-confirm" textColor={colors.error} onPress={() => setConfirmDelete(false)}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}
