/**
 * Config plugin: static launcher shortcut "Add entry". Writes res/xml/shortcuts.xml (the shortcut
 * fires bacchat://add, which opens k5), adds its label as a string resource and points the
 * launcher activity at it with the android.app.shortcuts meta-data.
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORT_LABEL = 'Add entry';
const LONG_LABEL = 'Add an entry';

function shortcutsXml(packageName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="add_entry"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_add_entry_short"
    android:shortcutLongLabel="@string/shortcut_add_entry_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="bacchat://add"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity" />
  </shortcut>
</shortcuts>
`;
}

function addShortcutMeta(manifest) {
  const app = manifest.manifest.application?.[0];
  const activity = (app?.activity ?? []).find((a) => a.$['android:name'] === '.MainActivity');
  if (!activity) throw new Error('withShortcuts: MainActivity not found in AndroidManifest.xml');
  const meta = activity['meta-data'] ?? [];
  if (!meta.some((m) => m.$['android:name'] === 'android.app.shortcuts')) {
    meta.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
  }
  activity['meta-data'] = meta;
  return manifest;
}

const withShortcuts = (config) => {
  config = withAndroidManifest(config, (c) => {
    c.modResults = addShortcutMeta(c.modResults);
    return c;
  });
  config = withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'shortcut_add_entry_short', translatable: 'true' }, _: SHORT_LABEL }],
      c.modResults,
    );
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'shortcut_add_entry_long', translatable: 'true' }, _: LONG_LABEL }],
      c.modResults,
    );
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const pkg = c.android?.package ?? 'app.bacchat';
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'shortcuts.xml'), shortcutsXml(pkg));
      return c;
    },
  ]);
};

module.exports = withShortcuts;
module.exports.shortcutsXml = shortcutsXml;
module.exports.addShortcutMeta = addShortcutMeta;
