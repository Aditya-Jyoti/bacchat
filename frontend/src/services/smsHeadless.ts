/**
 * Headless JS task for SMS that arrive while the app is closed. The native SmsReceiver queues the
 * message and starts BacchatSmsHeadlessService, which runs this task with the raw message. We read
 * it with the same pipeline as a live message (ingestService.processSms), post the calm
 * notification, then acknowledge it so the next launch does not repeat it. Anything that fails
 * stays queued and is picked up on next launch. Nothing is logged.
 */
import { AppRegistry } from 'react-native';

import { getSmsNative, type RawSms, type SmsNative } from '../../modules/bacchat-sms/src';
import { hydrateAll } from '../lib/persistence';
import { usePreferences } from '../lib/preferences';
import { createIngestService, type IngestService } from './ingestService';
import { createServices } from './services';

export const SMS_HEADLESS_TASK = 'BacchatSmsHeadless';

export type SmsHeadlessDeps = {
  native: SmsNative | null;
  /** Loads saved preferences. */
  hydrate: () => Promise<void>;
  /** The ingest service on lazily created services. Called at most once per process. */
  getIngest: () => Promise<IngestService>;
};

let ingestPromise: Promise<IngestService> | null = null;

/** Services and ingest service for background runs, built on first use and kept for the process. */
function defaultIngest(): Promise<IngestService> {
  if (!ingestPromise) {
    ingestPromise = createServices().then((services) =>
      createIngestService({ db: services.db, now: services.now, native: getSmsNative(), extractor: services.ai.extractor }),
    );
    ingestPromise.catch(() => {
      ingestPromise = null;
    });
  }
  return ingestPromise;
}

const defaults = (): SmsHeadlessDeps => ({ native: getSmsNative(), hydrate: hydrateAll, getIngest: defaultIngest });

function isRawSms(x: unknown): x is RawSms {
  const s = x as RawSms | null;
  return !!s && typeof s.id === 'string' && typeof s.address === 'string' && typeof s.body === 'string' && typeof s.receivedAt === 'number';
}

/** Process one message handed over by the native service. Resolves quietly on any failure. */
export async function runSmsHeadlessTask(data: unknown, deps: SmsHeadlessDeps = defaults()): Promise<void> {
  if (!isRawSms(data) || !deps.native) return;
  try {
    await deps.hydrate();
    // The receiver is already off when the switch is off; this is a second guard.
    if (!usePreferences.getState().smsIngestEnabled) return;
    const ingest = await deps.getIngest();
    await ingest.processSms(data, { notify: true });
    deps.native.acknowledge([data.id]);
  } catch {
    /* stays queued; the next launch reads it */
  }
}

/** Register the task. Call once from index.ts, before the root component is registered. */
export function registerSmsHeadlessTask(): void {
  AppRegistry.registerHeadlessTask(SMS_HEADLESS_TASK, () => (data: unknown) => runSmsHeadlessTask(data));
}

/** For tests. */
export function resetSmsHeadlessForTests(): void {
  ingestPromise = null;
}
