/**
 * k24: the "Read bank SMS" row, wired to the ingest service. Turning it on asks for SMS access,
 * adds recent bank messages once, and then watches new ones. Everything stays on this phone. When
 * access is not allowed, pasting a message still works.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Switch } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { usePreferences } from '../../../lib/preferences';
import { useIngestService } from '../../../services';
import { useTheme } from '../../../theme';
import { PasteMessage } from '../../money/parts/PasteMessage';
import { YouRow } from '../parts/YouRow';

export function SmsSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const ingest = useIngestService();
  const on = usePreferences((s) => s.smsIngestEnabled);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    void ingest.pending().then((p) => alive && setPending(p.length));
    return () => {
      alive = false;
    };
  }, [ingest, on]);

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
      {pending > 0 ? (
        <Text testID="settings-sms-pending" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 6 }]}>
          {t('ingestUi.pendingCount', { n: pending })}
        </Text>
      ) : null}
      <PasteMessage testID="settings-paste" />
    </View>
  );
}
