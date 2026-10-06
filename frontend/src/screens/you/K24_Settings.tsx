/** k24: Settings. Grouped M3 list: theme segmented, switches, chevrons, Delete all data behind a dialog. */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Switch } from 'react-native-paper';

import { ScreenScaffold } from '../../components';
import { t } from '../../lib/i18n';
import { usePreferences } from '../../lib/preferences';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { GroupCaption, YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';
import { AdvisorSection } from './settings/AdvisorSection';
import { ServerSection } from './settings/ServerSection';
import { useServices } from '../../services';

type ThemeChoice = 'system' | 'light' | 'dark';
type SwitchId = 'wallpaper' | 'sms' | 'email' | 'upi' | 'nudges' | 'reminders' | 'lock' | 'hide';

const SWITCHES: Record<SwitchId, { icon: string; title: string; sub: string }> = {
  wallpaper: { icon: 'palette', title: 'settingsUi.wallpaperTitle', sub: 'settingsUi.wallpaperSub' },
  sms: { icon: 'sms', title: 'settingsUi.smsTitle', sub: 'settingsUi.smsSub' },
  email: { icon: 'mail', title: 'settingsUi.emailTitle', sub: 'rahul.sharma@gmail.com' },
  upi: { icon: 'notifications_active', title: 'settingsUi.upiTitle', sub: 'settingsUi.upiSub' },
  nudges: { icon: 'spa', title: 'settingsUi.nudgesTitle', sub: 'settingsUi.nudgesSub' },
  reminders: { icon: 'event', title: 'settingsUi.remindersTitle', sub: 'settingsUi.remindersSub' },
  lock: { icon: 'fingerprint', title: 'settingsUi.lockTitle', sub: 'settingsUi.lockSub' },
  hide: { icon: 'visibility_off', title: 'settingsUi.hideTitle', sub: 'settingsUi.hideSub' },
};

export default function K24_Settings(): React.JSX.Element {
  const { colors, typography, colorSource } = useTheme();
  const { go, back } = useKidNav();
  const choice = usePreferences((s) => s.theme);
  const setChoice = usePreferences((s) => s.setTheme);
  const [on, setOn] = useState<Record<SwitchId, boolean>>({
    wallpaper: true, sms: true, email: true, upi: false, nudges: true, reminders: true, lock: true, hide: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { settings } = useServices();
  const [syncOn, setSyncOn] = useState(settings.isSyncEnabled());
  useEffect(() => {
    return settings.subscribe(() => setSyncOn(settings.isSyncEnabled()));
  }, [settings]);

  const sw = (id: SwitchId) => {
    const row = SWITCHES[id];
    const title = t(row.title);
    // The email row shows the account address as is; every other subtitle is a bundle key.
    const sub = id === 'wallpaper' && !on.wallpaper ? t('settingsUi.wallpaperOff') : id === 'email' ? row.sub : t(row.sub);
    return (
      <YouRow
        key={id}
        testID={`settings-row-${id}`}
        icon={row.icon}
        title={title}
        subtitle={sub}
        trailing={
          <Switch
            testID={`settings-switch-${id}`}
            value={on[id]}
            onValueChange={(v) => setOn((s) => ({ ...s, [id]: v }))}
            accessibilityLabel={title}
          />
        }
      />
    );
  };

  return (
    <ScreenScaffold testID="screen-k24" edges={['top', 'left', 'right']}>
      <AppBar title={t('settingsUi.title')} onBack={back} />
      <GroupCaption>{t('settingsUi.look')}</GroupCaption>
      <View style={{ paddingTop: 4, paddingBottom: 10 }}>
        <SegmentedButtons
          value={choice}
          onValueChange={(v) => setChoice(v as ThemeChoice)}
          buttons={[
            { value: 'system', label: t('settingsUi.themeSystem'), testID: 'theme-system', showSelectedCheck: true },
            { value: 'light', label: t('settingsUi.themeLight'), testID: 'theme-light', showSelectedCheck: true },
            { value: 'dark', label: t('settingsUi.themeDark'), testID: 'theme-dark', showSelectedCheck: true },
          ]}
        />
      </View>
      {sw('wallpaper')}
      <Text testID="settings-colour-source" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 6 }]}>
        {colorSource === 'dynamic' && on.wallpaper ? t('settingsUi.coloursDynamic') : t('settingsUi.coloursKhata')}
      </Text>
      <YouRow icon="currency_rupee" title={t('settingsUi.numberFormat')} subtitle={t('settingsUi.numberFormatSub')} onPress={() => undefined} />
      <GroupCaption>{t('settingsUi.autoAdd')}</GroupCaption>
      {(['sms', 'email', 'upi'] as const).map(sw)}
      <GroupCaption>{t('settingsUi.nudges')}</GroupCaption>
      {(['nudges', 'reminders'] as const).map(sw)}
      <GroupCaption>{t('settingsUi.privacySecurity')}</GroupCaption>
      {(['lock', 'hide'] as const).map(sw)}
      <YouRow
        testID="settings-row-backup"
        icon="cloud_sync"
        title={t('settingsUi.backupSync')}
        subtitle={syncOn ? t('settingsUi.backupOn') : t('settingsUi.backupOff')}
        onPress={() => go('k25')}
      />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 8 }]}>
        {`${t('privacy.onDevice')} ${t('settingsUi.smsChoice')}`}
      </Text>
      <AdvisorSection />
      <ServerSection />
      <GroupCaption>{t('settingsUi.data')}</GroupCaption>
      <YouRow icon="ios_share" title={t('settingsUi.export')} subtitle={t('settingsUi.exportSub')} onPress={() => undefined} />
      <YouRow icon="upload_file" title={t('settingsUi.import_')} subtitle={t('settingsUi.importSub')} onPress={() => undefined} />
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
          {t('settingsUi.deleteAll')}
        </Button>
      </View>
      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t('settingsUi.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              {t('settingsUi.deleteBody')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="settings-delete-keep" onPress={() => setConfirmDelete(false)}>{t('settingsUi.keep')}</Button>
            <Button testID="settings-delete-confirm" textColor={colors.error} onPress={() => setConfirmDelete(false)}>{t('settingsUi.delete')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}
