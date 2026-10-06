/**
 * Google sign-in for Drive sync (scope drive.appdata only), behind the AccessTokenProvider interface
 * the Drive store uses. The sign-in UI is expo-auth-session (system browser, PKCE, no client secret).
 * The OAuth client id is build-time config (app.json extra.googleClientId); see docs/decisions.md for
 * the Google Cloud setup that is still to be done.
 */
import { UnauthorizedError } from '../lib/sync/client';
import { DRIVE_APPDATA_SCOPE, type AccessTokenProvider } from '../lib/sync/targets';
import type { SecureStore } from './secure';

export const GOOGLE_TOKEN_KEY = 'bacchat.google.tokens';

export interface TokenSet {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  refreshToken?: string;
}

/** The three calls we need from the OAuth library. The real one wraps expo-auth-session. */
export interface GoogleOAuth {
  /** Opens the consent screen. Returns the one-time code, or null if the person cancelled. */
  authorize(o: { clientId: string; redirectUri: string; scopes: string[] }): Promise<{ code: string; codeVerifier: string } | null>;
  exchange(o: { clientId: string; redirectUri: string; code: string; codeVerifier: string }): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  refresh(o: { clientId: string; refreshToken: string }): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
}

export interface GoogleTokenProvider extends AccessTokenProvider {
  /** True when this build has a Google client id. */
  isConfigured(): boolean;
  isSignedIn(): Promise<boolean>;
  /** Interactive sign-in. Resolves false if the person cancelled. */
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
}

/** Google's Android OAuth clients redirect to the reversed client id. */
export function googleRedirectUri(clientId: string): string {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, '')}:/oauthredirect`;
}

export function createGoogleTokenProvider(deps: {
  secure: SecureStore;
  clientId: () => string;
  oauth?: GoogleOAuth;
  now?: () => number;
}): GoogleTokenProvider {
  const now = deps.now ?? Date.now;
  const oauth = (): GoogleOAuth => deps.oauth ?? expoGoogleOAuth();
  let cache: TokenSet | null = null;

  const load = async (): Promise<TokenSet | null> => {
    if (cache) return cache;
    const raw = await deps.secure.get(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    try {
      cache = JSON.parse(raw) as TokenSet;
    } catch {
      cache = null;
    }
    return cache;
  };
  const save = async (t: TokenSet): Promise<void> => {
    cache = t;
    await deps.secure.set(GOOGLE_TOKEN_KEY, JSON.stringify(t));
  };

  return {
    isConfigured: () => deps.clientId().length > 0,
    async isSignedIn() {
      return !!(await load())?.refreshToken;
    },
    async getAccessToken() {
      const clientId = deps.clientId();
      if (!clientId) throw new UnauthorizedError('Google Drive is not set up in this build.');
      const t = await load();
      if (!t) throw new UnauthorizedError('Sign in to Google Drive first.');
      if (t.accessToken && t.expiresAt - 60_000 > now()) return t.accessToken;
      if (!t.refreshToken) throw new UnauthorizedError('Sign in to Google Drive again.');
      try {
        const r = await oauth().refresh({ clientId, refreshToken: t.refreshToken });
        await save({ accessToken: r.accessToken, expiresAt: now() + r.expiresIn * 1000, refreshToken: r.refreshToken ?? t.refreshToken });
      } catch {
        throw new UnauthorizedError('Sign in to Google Drive again.');
      }
      return (await load())!.accessToken;
    },
    invalidate() {
      if (cache) cache = { ...cache, expiresAt: 0 };
    },
    async signIn() {
      const clientId = deps.clientId();
      if (!clientId) throw new UnauthorizedError('Google Drive is not set up in this build.');
      const redirectUri = googleRedirectUri(clientId);
      const got = await oauth().authorize({ clientId, redirectUri, scopes: [DRIVE_APPDATA_SCOPE] });
      if (!got) return false;
      const r = await oauth().exchange({ clientId, redirectUri, code: got.code, codeVerifier: got.codeVerifier });
      await save({ accessToken: r.accessToken, expiresAt: now() + r.expiresIn * 1000, refreshToken: r.refreshToken });
      return true;
    },
    async signOut() {
      cache = null;
      await deps.secure.remove(GOOGLE_TOKEN_KEY);
    },
  };
}

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/** expo-auth-session behind GoogleOAuth. Loaded on first use so tests and non-Drive users never touch it. */
export function expoGoogleOAuth(): GoogleOAuth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const A = require('expo-auth-session') as typeof import('expo-auth-session');
  return {
    async authorize({ clientId, redirectUri, scopes }) {
      const req = new A.AuthRequest({
        clientId,
        redirectUri,
        scopes,
        responseType: A.ResponseType.Code,
        usePKCE: true,
        extraParams: { access_type: 'offline', prompt: 'consent' },
      });
      const res = await req.promptAsync(GOOGLE_DISCOVERY);
      if (res.type !== 'success' || !res.params.code || !req.codeVerifier) return null;
      return { code: res.params.code, codeVerifier: req.codeVerifier };
    },
    async exchange({ clientId, redirectUri, code, codeVerifier }) {
      const r = await A.exchangeCodeAsync({ clientId, redirectUri, code, extraParams: { code_verifier: codeVerifier } }, GOOGLE_DISCOVERY);
      return { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresIn: r.expiresIn ?? 3600 };
    },
    async refresh({ clientId, refreshToken }) {
      const r = await A.refreshAsync({ clientId, refreshToken }, GOOGLE_DISCOVERY);
      return { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresIn: r.expiresIn ?? 3600 };
    },
  };
}
