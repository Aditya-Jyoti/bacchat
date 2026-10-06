/** @jest-environment node */
/* global describe, it, expect */
const withShareIntent = require('../withShareIntent');
const withShortcuts = require('../withShortcuts');
const withHardenedManifest = require('../withHardenedManifest');
const withGoogleOAuthRedirect = require('../withGoogleOAuthRedirect');

const manifest = () => ({
  manifest: {
    application: [
      {
        activity: [
          {
            $: { 'android:name': '.MainActivity' },
            'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] }],
          },
        ],
      },
    ],
  },
});

describe('withShareIntent', () => {
  it('adds SEND and SEND_MULTIPLE image/* filters once', () => {
    const m = withShareIntent.addShareFilters(withShareIntent.addShareFilters(manifest()));
    const filters = m.manifest.application[0].activity[0]['intent-filter'];
    const actions = filters.map((f) => f.action[0].$['android:name']);
    expect(actions.filter((a) => a === 'android.intent.action.SEND')).toHaveLength(1);
    expect(actions.filter((a) => a === 'android.intent.action.SEND_MULTIPLE')).toHaveLength(1);
    const send = filters.find((f) => f.action[0].$['android:name'] === 'android.intent.action.SEND');
    expect(send.data[0].$['android:mimeType']).toBe('image/*');
    expect(send.category[0].$['android:name']).toBe('android.intent.category.DEFAULT');
  });
});

describe('withShortcuts', () => {
  it('points MainActivity at the shortcuts resource once', () => {
    const m = withShortcuts.addShortcutMeta(withShortcuts.addShortcutMeta(manifest()));
    const meta = m.manifest.application[0].activity[0]['meta-data'];
    expect(meta).toHaveLength(1);
    expect(meta[0].$).toEqual({ 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' });
  });

  it('the Add entry shortcut fires bacchat://add at MainActivity', () => {
    const xml = withShortcuts.shortcutsXml('app.bacchat');
    expect(xml).toContain('android:data="bacchat://add"');
    expect(xml).toContain('android:targetClass="app.bacchat.MainActivity"');
    expect(xml).toContain('android:shortcutId="add_entry"');
  });
});

describe('withGoogleOAuthRedirect', () => {
  const filters = (m) => m.manifest.application[0].activity[0]['intent-filter'];

  it('reverses the client id into the redirect scheme', () => {
    expect(withGoogleOAuthRedirect.redirectScheme('123-abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.123-abc');
    expect(withGoogleOAuthRedirect.redirectScheme('123-abc')).toBe('com.googleusercontent.apps.123-abc');
  });

  it('adds a browsable filter for the scheme once', () => {
    const id = '123-abc.apps.googleusercontent.com';
    const m = withGoogleOAuthRedirect.addOAuthRedirect(withGoogleOAuthRedirect.addOAuthRedirect(manifest(), id), id);
    const added = filters(m).filter((f) => f.data);
    expect(added).toHaveLength(1);
    expect(added[0].data[0].$).toEqual({ 'android:scheme': 'com.googleusercontent.apps.123-abc', 'android:path': '/oauthredirect' });
    expect(added[0].category.map((c) => c.$['android:name'])).toContain('android.intent.category.BROWSABLE');
  });

  it('does nothing when the client id is empty', () => {
    for (const id of ['', '  ', undefined]) {
      const m = withGoogleOAuthRedirect.addOAuthRedirect(manifest(), id);
      expect(filters(m)).toHaveLength(1);
    }
  });
});

describe('withHardenedManifest', () => {
  it('turns off backup and clear-text traffic', () => {
    const m = manifest();
    m.manifest.application[0].$ = { 'android:allowBackup': 'true' };
    withHardenedManifest.hardenManifest(m);
    expect(m.manifest.application[0].$['android:allowBackup']).toBe('false');
    expect(m.manifest.application[0].$['android:usesCleartextTraffic']).toBe('false');
  });
});
