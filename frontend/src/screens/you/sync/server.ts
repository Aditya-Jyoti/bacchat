/** Where Bacchat Cloud lives. The address is not secret; it is kept beside the other sync settings. */
import { getCloudUrl } from '../../../lib/appConfig';
import type { SecureStore } from '../../../services';

/**
 * The Bacchat Cloud address the build ships with (app.json extra.cloudUrl). The documented default is
 * empty, which means "enter your server address"; nothing is assumed about who runs the server.
 */
export const DEFAULT_CLOUD_URL = getCloudUrl();
const SERVER_KEY = 'bacchat.sync.server';

export function isValidServerUrl(url: string): boolean {
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(url.trim());
}

/** The saved server address, or the build's default (empty when none). */
export async function getServerUrl(secure: SecureStore): Promise<string> {
  const v = await secure.get(SERVER_KEY);
  return v && isValidServerUrl(v) ? v : DEFAULT_CLOUD_URL;
}

/** Saves a server address. An empty value goes back to the default. Returns false if it is not a valid address. */
export async function setServerUrl(secure: SecureStore, url: string): Promise<boolean> {
  const v = url.trim().replace(/\/+$/, '');
  if (!v) {
    await secure.remove(SERVER_KEY);
    return true;
  }
  if (!isValidServerUrl(v)) return false;
  await secure.set(SERVER_KEY, v);
  return true;
}
