/**
 * Config plugin: lets Google's OAuth redirect come back to the app (expo-auth-session, Android).
 * Google's Android clients redirect to the reversed client id, for example
 * com.googleusercontent.apps.123-abc:/oauthredirect. Reads extra.googleClientId from app.json and
 * adds a VIEW / BROWSABLE intent-filter for that scheme to MainActivity. Does nothing when the id
 * is empty, so builds without Google Drive set up carry no extra filter.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const PREFIX = 'com.googleusercontent.apps.';
const REDIRECT_PATH = '/oauthredirect';

/** The redirect scheme for a client id, or '' when there is no usable id. */
function redirectScheme(clientId) {
  const id = String(clientId ?? '')
    .trim()
    .replace(/\.apps\.googleusercontent\.com$/, '');
  return id ? `${PREFIX}${id}` : '';
}

function hasFilter(activity, scheme) {
  return (activity['intent-filter'] ?? []).some((f) => (f.data ?? []).some((d) => d.$['android:scheme'] === scheme));
}

function addOAuthRedirect(manifest, clientId) {
  const scheme = redirectScheme(clientId);
  if (!scheme) return manifest;
  const app = manifest.manifest.application?.[0];
  const activity = (app?.activity ?? []).find((a) => a.$['android:name'] === '.MainActivity');
  if (!activity) throw new Error('withGoogleOAuthRedirect: MainActivity not found in AndroidManifest.xml');
  activity['intent-filter'] = activity['intent-filter'] ?? [];
  if (hasFilter(activity, scheme)) return manifest;
  activity['intent-filter'].push({
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [
      { $: { 'android:name': 'android.intent.category.DEFAULT' } },
      { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
    ],
    data: [{ $: { 'android:scheme': scheme, 'android:path': REDIRECT_PATH } }],
  });
  return manifest;
}

const withGoogleOAuthRedirect = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = addOAuthRedirect(c.modResults, c.extra?.googleClientId);
    return c;
  });

module.exports = withGoogleOAuthRedirect;
module.exports.redirectScheme = redirectScheme;
module.exports.addOAuthRedirect = addOAuthRedirect;
