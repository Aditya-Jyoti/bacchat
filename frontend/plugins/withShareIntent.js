/**
 * Config plugin: lets the Android share sheet send images to Bacchat. Adds an intent-filter for
 * ACTION_SEND and ACTION_SEND_MULTIPLE with image/* to MainActivity. The BacchatShare native
 * module (modules/bacchat-share) reads the shared URIs.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const ACTIONS = ['android.intent.action.SEND', 'android.intent.action.SEND_MULTIPLE'];

function hasFilter(activity, action) {
  return (activity['intent-filter'] ?? []).some(
    (f) =>
      (f.action ?? []).some((a) => a.$['android:name'] === action) &&
      (f.data ?? []).some((d) => d.$['android:mimeType'] === 'image/*'),
  );
}

function addShareFilters(manifest) {
  const app = manifest.manifest.application?.[0];
  const activity = (app?.activity ?? []).find((a) => a.$['android:name'] === '.MainActivity');
  if (!activity) throw new Error('withShareIntent: MainActivity not found in AndroidManifest.xml');
  activity['intent-filter'] = activity['intent-filter'] ?? [];
  for (const action of ACTIONS) {
    if (hasFilter(activity, action)) continue;
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': action } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': 'image/*' } }],
    });
  }
  return manifest;
}

const withShareIntent = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = addShareFilters(c.modResults);
    return c;
  });

module.exports = withShareIntent;
module.exports.addShareFilters = addShareFilters;
