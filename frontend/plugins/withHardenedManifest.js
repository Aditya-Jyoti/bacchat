/**
 * Config plugin: privacy hardening for a finance app. Turns Android backup off (the encrypted
 * database and its key must never ride along in a cloud or adb backup) and states explicitly that
 * clear-text HTTP is not allowed. Cloud sync has its own end-to-end encryption; this only closes
 * the platform paths.
 */
const { withAndroidManifest } = require('expo/config-plugins');

function hardenManifest(manifest) {
  const app = manifest.manifest.application?.[0];
  if (!app) throw new Error('withHardenedManifest: <application> not found in AndroidManifest.xml');
  app.$['android:allowBackup'] = 'false';
  app.$['android:usesCleartextTraffic'] = 'false';
  return manifest;
}

const withHardenedManifest = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = hardenManifest(c.modResults);
    return c;
  });

module.exports = withHardenedManifest;
module.exports.hardenManifest = hardenManifest;
