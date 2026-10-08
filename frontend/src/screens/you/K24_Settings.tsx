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
import { AiSection } from './settings/AiSection';
import { AskHistorySection } from './settings/AskHistorySection';
import { ModelWifiSection } from './settings/ModelWifiSection';
import { NpsNavSection } from './settings/NpsNavSection';
import { NameSection } from './settings/NameSection';
import { ServerSection } from './settings/ServerSection';
import { SmsSection } from './settings/SmsSection';
import { authenticate, canUseAppLock, useServices } from '../../services';

type ThemeChoice = 'system' | 'light' | 'dark';
type SwitchId = 'wallpaper' | 'sms' | 'email' | 'upi' | 'nudges' | 'reminders' | 'lock' | 'hide';

const SWITCHES: Record<SwitchId, { icon: string; title: string; sub: string }> = {
  wallpaper: { icon: 'palette', title: 'settingsUi.wallpaperTitle', sub: 'settingsUi.wallpaperSub' },
  sms: { icon: 'sms', title: 'settingsUi.smsTitle', sub: 'settingsUi.smsSub' },
  email: { icon: 'mail', title: 'settingsUi.emailTitle', sub: 'moreUi.emailSub' },
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
  const wallpaperOn = usePreferences((s) => s.wallpaperColors);
  const setWallpaperOn = usePreferences((s) => s.setWallpaperColors);
  const lockOn = usePreferences((s) => s.appLock);
  const setLockOn = usePreferences((s) => s.setAppLock);
  const [lockNote, setLockNote] = useState<string | null>(null);
  const [localOn, setOn] = useState<Record<SwitchId, boolean>>({
    wallpaper: true, sms: true, email: true, upi: false, nudges: true, reminders: true, lock: true, hide: false,
  });
  // Wallpaper colours and app lock are real preferences; the other switches are still local.
  const on: Record<SwitchId, boolean> = { ...localOn, wallpaper: wallpaperOn, lock: lockOn };
  const change = (id: SwitchId, v: boolean): void => {
    if (id === 'wallpaper') setWallpaperOn(v);
    else if (id === 'lock') void toggleLock(v);
    else setOn((s) => ({ ...s, [id]: v }));
  };
  // Turning the lock on asks the phone once, so a lock that cannot open never gets switched on.
  const toggleLock = async (v: boolean): Promise<void> => {
    setLockNote(null);
    if (!v) {
      setLockOn(false);
      return;
    }
    if (!(await canUseAppLock())) {
      setLockNote(t('settingsUi.lockUnavailable'));
      return;
    }
    const r = await authenticate({ message: t('lockUi.prompt'), cancel: t('lockUi.cancel') });
    if (r === 'ok') setLockOn(true);
    else setLockNote(t('settingsUi.lockNotConfirmed'));
  };
  const [confirm, setConfirm] = useState<'all' | 'sample' | null>(null);
  const [busy, setBusy] = useState(false);
  const services = useServices();
  const { settings } = services;
  const sampleOn = services.isSample();
  const wipe = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await services.clearAllData();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
    go('k1');
  };
  const [syncOn, setSyncOn] = useState(settings.isSyncEnabled());
  useEffect(() => {
    return settings.subscribe(() => setSyncOn(settings.isSyncEnabled()));
  }, [settings]);

  const sw = (id: SwitchId) => {
    const row = SWITCHES[id];
    const title = t(row.title);
    const sub =
      id === 'wallpaper' && !on.wallpaper ? t('settingsUi.wallpaperOff')
      : id === 'lock' && lockNote ? lockNote
      : t(row.sub);
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
            onValueChange={(v) => change(id, v)}
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
      <NameSection />
      <GroupCaption>{t('settingsUi.autoAdd')}</GroupCaption>
      <SmsSection />
      {(['email', 'upi'] as const).map(sw)}
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
      <AiSection />
      <ModelWifiSection />
      <AskHistorySection />
      <AdvisorSection />
      <ServerSection />
      <NpsNavSection />
      <GroupCaption>{t('settingsUi.data')}</GroupCaption>
      <YouRow icon="ios_share" title={t('settingsUi.export')} subtitle={t('settingsUi.exportSub')} onPress={() => undefined} />
      <YouRow icon="upload_file" title={t('settingsUi.import_')} subtitle={t('settingsUi.importSub')} onPress={() => undefined} />
      {sampleOn ? (
        <YouRow
          testID="settings-clear-sample"
          icon="auto_delete"
          title={t('settingsUi.clearSample')}
          subtitle={t('settingsUi.clearSampleSub')}
          onPress={() => setConfirm('sample')}
        />
      ) : null}
      <View style={{ paddingVertical: 16 }}>
        <Button
          testID="settings-delete"
          mode="outlined"
          icon="delete"
          textColor={colors.error}
          style={{ borderColor: colors.outline }}
          contentStyle={{ height: 48 }}
          onPress={() => setConfirm('all')}
        >
          {t('settingsUi.deleteAll')}
        </Button>
      </View>
      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t(confirm === 'sample' ? 'settingsUi.clearSampleTitle' : 'settingsUi.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              {t(confirm === 'sample' ? 'settingsUi.clearSampleBody' : 'settingsUi.deleteBody')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="settings-delete-keep" onPress={() => setConfirm(null)}>{t('settingsUi.keep')}</Button>
            <Button testID="settings-delete-confirm" disabled={busy} textColor={colors.error} onPress={() => void wipe()}>
              {t(confirm === 'sample' ? 'settingsUi.clearSampleConfirm' : 'settingsUi.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}
