/**
 * App lock logic with expo-local-authentication behind a small injectable interface.
 * The OS shows its own prompt (fingerprint, face, or the phone's PIN/pattern as fallback).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** Lock again after this long in the background. */
export const LOCK_AFTER_MS = 60_000;

export type AuthResult = 'ok' | 'failed' | 'unavailable';

export interface LocalAuth {
  /** 0 means nothing is enrolled (no PIN, pattern or biometric). */
  getEnrolledLevelAsync(): Promise<number>;
  authenticateAsync(options: { promptMessage: string; cancelLabel: string; disableDeviceFallback: boolean }): Promise<{ success: boolean }>;
}

function expoAuth(): LocalAuth | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuth;
  } catch {
    return null;
  }
}

/** True when the phone has a screen lock or biometric the prompt can use. */
export async function canUseAppLock(auth: LocalAuth | null = expoAuth()): Promise<boolean> {
  if (!auth) return false;
  try {
    return (await auth.getEnrolledLevelAsync()) > 0;
  } catch {
    return false;
  }
}

/** Ask the OS to confirm the owner. 'unavailable' when the phone has no lock to ask with. */
export async function authenticate(prompt: { message: string; cancel: string }, auth: LocalAuth | null = expoAuth()): Promise<AuthResult> {
  if (!(await canUseAppLock(auth)) || !auth) return 'unavailable';
  try {
    const r = await auth.authenticateAsync({ promptMessage: prompt.message, cancelLabel: prompt.cancel, disableDeviceFallback: false });
    return r.success ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

/** True when the app has been in the background long enough to need unlocking. */
export function shouldLock(backgroundedAt: number | null, now: number, afterMs: number = LOCK_AFTER_MS): boolean {
  return backgroundedAt != null && now - backgroundedAt >= afterMs;
}

export type AppLockOptions = {
  enabled: boolean;
  prompt: { message: string; cancel: string };
  auth?: LocalAuth | null;
  now?: () => number;
  afterMs?: number;
};

export type AppLockState = {
  locked: boolean;
  /** True after a cancelled or failed prompt, until the next try. */
  failed: boolean;
  unlock(): Promise<void>;
};

/**
 * Locked on cold start when enabled, and again after afterMs in the background. A phone with no
 * screen lock never traps the owner: the lock opens by itself.
 */
export function useAppLock(opts: AppLockOptions): AppLockState {
  const { enabled, prompt, auth, now = Date.now, afterMs = LOCK_AFTER_MS } = opts;
  const [locked, setLocked] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  });

  // Turning the lock off opens the app. Turning it on while using the app does not lock it.
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (!enabled) setLocked(false);
  }

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (busyRef.current) return;
      if (s === 'background') backgroundedAt.current = nowRef.current();
      else if (s === 'active') {
        if (shouldLock(backgroundedAt.current, nowRef.current(), afterMs)) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, afterMs]);

  const message = prompt.message;
  const cancel = prompt.cancel;
  const unlock = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const r = await authenticate({ message, cancel }, auth);
    busyRef.current = false;
    if (r === 'failed') {
      setFailed(true);
      return;
    }
    setFailed(false);
    setLocked(false);
  }, [auth, message, cancel]);

  // Prompt as soon as the lock shows.
  useEffect(() => {
    // State is only set after the OS prompt answers, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (locked && enabled) void unlock();
  }, [locked, enabled, unlock]);

  return { locked: locked && enabled, failed, unlock };
}
