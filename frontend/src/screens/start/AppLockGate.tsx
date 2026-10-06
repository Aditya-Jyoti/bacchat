/** Wraps the app: shows the lock screen over it while locked. The app stays mounted underneath, hidden from TalkBack. */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '../../lib/i18n';
import { useAppLock, type AppLockOptions } from '../../services/appLock';
import LockScreen from './LockScreen';

export type AppLockGateProps = Omit<AppLockOptions, 'prompt'> & { children: React.ReactNode };

export default function AppLockGate({ children, ...opts }: AppLockGateProps): React.JSX.Element {
  const { locked, failed, unlock } = useAppLock({ ...opts, prompt: { message: t('lockUi.prompt'), cancel: t('lockUi.cancel') } });
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={locked}>
        {children}
      </View>
      {locked ? (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen failed={failed} onUnlock={() => void unlock()} />
        </View>
      ) : null}
    </View>
  );
}
