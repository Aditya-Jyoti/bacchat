/**
 * Build-time configuration from app.json "extra" (read through expo-constants). Nothing secret
 * belongs here: it is shipped inside the app.
 *
 *   extra.cloudUrl        Default Bacchat Cloud address. Empty means "enter your server address".
 *   extra.googleClientId  Google OAuth client id (Android type) for Drive sync. Empty hides Drive sign-in.
 *   extra.npsNavUrl       Default NPS NAV source. Empty uses the built-in default in lib/nav.
 */
export type AppExtra = {
  cloudUrl?: string;
  googleClientId?: string;
  npsNavUrl?: string;
};

let override: AppExtra | null = null;

/** Tests set this; pass null to go back to the real app config. */
export function setAppExtraForTests(extra: AppExtra | null): void {
  override = extra;
}

export function getAppExtra(): AppExtra {
  if (override) return override;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as { default?: { expoConfig?: { extra?: AppExtra } | null } };
    return (mod.default ?? (mod as unknown as { expoConfig?: { extra?: AppExtra } })).expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Default Bacchat Cloud address, or '' when the build does not ship one. */
export function getCloudUrl(): string {
  return str(getAppExtra().cloudUrl).replace(/\/+$/, '');
}

/** Google OAuth client id, or '' when Drive sign-in is not configured in this build. */
export function getGoogleClientId(): string {
  return str(getAppExtra().googleClientId);
}

export function getNpsNavUrlDefault(): string {
  return str(getAppExtra().npsNavUrl);
}
