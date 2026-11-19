/**
 * k24: the "Read bank SMS" row, wired to the ingest service. Turning it on asks for SMS access
 * and then watches new messages only (older ones are not read; a screenshot import covers the past). Everything stays on this phone. When
 * access is not allowed, pasting a message still works.
 */
import React, { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Switch } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { usePreferences } from '../../../lib/preferences';
import { useIngestService } from '../../../services';
import { useTheme } from '../../../theme';
import { PendingConflictsSheet } from '../../money/pending/PendingConflictsSheet';
import { PasteMessage } from '../../money/parts/PasteMessage';
import { YouRow } from '../parts/YouRow';

export function SmsSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const ingest = useIngestService();
  const on = usePreferences((s) => s.smsIngestEnabled);
  const notifOn = usePreferences((s) => s.notifIngestEnabled);
  const [access, setAccess] = useState(() => ingest.hasNotificationAccess());
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    void ingest.pending().then((p) => alive && setPending(p.length));
    return () => {
      alive = false;
    };
  }, [ingest, on]);

  // Notification access is granted in system settings; check again when the person comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setAccess(ingest.hasNotificationAccess());
    });
    return () => sub.remove();
  }, [ingest]);

  const toggleNotif = async (next: boolean): Promise<void> => {
    if (!next) {
      await ingest.disableNotifications();
      return;
    }
    const r = await ingest.enableNotifications();
    setAccess(r === 'enabled');
    if (r === 'unavailable') setNote(t('ingestUi.unavailable'));
  };

  const toggle = async (next: boolean): Promise<void> => {
    if (!next) {
      await ingest.disable();
      setNote(null);
      return;
    }
    const r = await ingest.enable();
    setNote(r === 'enabled' ? null : r === 'unavailable' ? t('ingestUi.unavailable') : t('ingestUi.permissionNeeded'));
    setPending((await ingest.pending()).length);
  };

  const title = t('ingestUi.settingsTitle');
  return (
    <View testID="settings-sms">
      <YouRow
        testID="settings-row-sms"
        icon="sms"
        title={title}
        subtitle={t('ingestUi.settingsSub')}
        trailing={<Switch testID="settings-switch-sms" value={on} onValueChange={(v) => void toggle(v)} accessibilityLabel={title} />}
      />
      {note ? (
        <Text testID="settings-sms-note" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 6 }]}>{note}</Text>
      ) : null}
      <YouRow
        testID="settings-row-notif"
        icon="notifications"
        title={t('ingestUi.notifTitle')}
        subtitle={t('ingestUi.notifSub')}
        trailing={<Switch testID="settings-switch-notif" value={notifOn} onValueChange={(v) => void toggleNotif(v)} accessibilityLabel={t('ingestUi.notifTitle')} />}
      />
      {notifOn && !access ? (
        <>
          <Text testID="settings-notif-note" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 6 }]}>{t('ingestUi.notifAccess')}</Text>
          <YouRow testID="settings-notif-open" icon="open_in_new" title={t('ingestUi.notifAccessRow')} onPress={() => void ingest.enableNotifications()} />
        </>
      ) : null}
      {pending > 0 ? (
        <YouRow
          testID="settings-sms-pending"
          icon="help"
          title={t('moreUi.pendingTitle')}
          subtitle={t('moreUi.pendingRow', { n: pending })}
          onPress={() => setSheet(true)}
        />
      ) : null}
      <PendingConflictsSheet
        visible={sheet}
        onClose={() => {
          setSheet(false);
          void ingest.pending().then((p) => setPending(p.length));
        }}
      />
      <PasteMessage testID="settings-paste" />
    </View>
  );
}
