/**
 * Starts the Android entry points while the app runs: SMS reading (when the user turned it on)
 * and the share-sheet listener. Mount once inside AppServicesProvider.
 */
import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';

import { getShareNative } from '../../modules/bacchat-share/src';
import { getSmsNative } from '../../modules/bacchat-sms/src';
import { usePreferences } from '../lib/preferences';
import { createIngestService, type IngestService } from './ingestService';
import { createShareService } from './shareService';
import { useServices } from './AppServicesProvider';
import type { Services } from './services';

/** The ingest service for the current services. One per app run. */
const cache = new WeakMap<Services, IngestService>();

export function useIngestService(): IngestService {
  const services = useServices();
  return useMemo(() => {
    let svc = cache.get(services);
    if (!svc) {
      svc = createIngestService({ db: services.db, now: services.now, native: getSmsNative(), extractor: services.ai.extractor });
      cache.set(services, svc);
    }
    return svc;
  }, [services]);
}

export function useNativeEntryPoints(): void {
  const ingest = useIngestService();
  const enabled = usePreferences((s) => s.smsIngestEnabled);

  useEffect(() => {
    const share = createShareService({ native: getShareNative(), open: (url) => Linking.openURL(url) });
    share.start();
    return () => share.stop();
  }, []);

  useEffect(() => {
    if (!enabled) {
      ingest.stop();
      return;
    }
    void ingest.start();
    return () => ingest.stop();
  }, [ingest, enabled]);
}
