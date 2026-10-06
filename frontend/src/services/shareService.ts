/**
 * Images shared into Bacchat from the Android share sheet open the reading screen (k7). The route
 * goes through the deep link bacchat://import?uri=..., so React Navigation's linking does the
 * navigation whether the app was just launched or already running.
 */
import { importLink } from '../navigation/linking';
import type { ShareNative, ShareSubscription } from '../../modules/bacchat-share/src';

export type ShareServiceOptions = {
  native: ShareNative | null;
  /** Opens a bacchat:// link. The app passes Linking.openURL. */
  open: (url: string) => void | Promise<unknown>;
};

export type ShareService = { start(): void; stop(): void };

export function createShareService({ native, open }: ShareServiceOptions): ShareService {
  let sub: ShareSubscription | null = null;
  // k7 reads one image at a time; with several shared, the first opens now.
  const route = (uris: string[]): void => {
    const first = uris.find((u) => typeof u === 'string' && u.length > 0);
    if (first) void open(importLink(first));
  };
  return {
    start() {
      if (!native || sub) return;
      sub = native.addListener('onShare', (e) => route(e.uris));
      route(native.getInitialSharedUris());
    },
    stop() {
      sub?.remove();
      sub = null;
    },
  };
}
