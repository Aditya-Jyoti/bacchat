import { UnauthorizedError } from '../../lib/sync/client';
import { createGoogleTokenProvider, googleRedirectUri, GOOGLE_TOKEN_KEY, type GoogleOAuth } from '../googleAuth';
import { createMemorySecureStore } from '../secure';

function setup(clientId = 'abc.apps.googleusercontent.com') {
  let now = 1_000_000;
  const calls: string[] = [];
  const oauth: GoogleOAuth = {
    authorize: jest.fn(async (o) => {
      calls.push(`authorize ${o.scopes.join(',')} ${o.redirectUri}`);
      return { code: 'code1', codeVerifier: 'ver1' };
    }),
    exchange: jest.fn(async () => ({ accessToken: 'a1', refreshToken: 'r1', expiresIn: 3600 })),
    refresh: jest.fn(async () => ({ accessToken: 'a2', expiresIn: 3600 })),
  };
  const secure = createMemorySecureStore();
  const p = createGoogleTokenProvider({ secure, clientId: () => clientId, oauth, now: () => now });
  return { p, oauth, secure, calls, tick: (ms: number) => (now += ms) };
}

describe('Google token provider', () => {
  it('builds the Android redirect from the client id and asks only for the app-data scope', async () => {
    expect(googleRedirectUri('abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.abc:/oauthredirect');
    const { p, calls } = setup();
    expect(await p.signIn()).toBe(true);
    expect(calls[0]).toBe('authorize https://www.googleapis.com/auth/drive.appdata com.googleusercontent.apps.abc:/oauthredirect');
  });

  it('is not configured without a client id and refuses to sign in', async () => {
    const { p } = setup('');
    expect(p.isConfigured()).toBe(false);
    await expect(p.signIn()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(p.getAccessToken()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns the cached token, refreshes near expiry, and keeps the refresh token', async () => {
    const { p, oauth, secure, tick } = setup();
    await p.signIn();
    expect(await p.getAccessToken()).toBe('a1');
    expect(oauth.refresh).not.toHaveBeenCalled();
    tick(3600_000 - 30_000);
    expect(await p.getAccessToken()).toBe('a2');
    expect(JSON.parse((await secure.get(GOOGLE_TOKEN_KEY))!).refreshToken).toBe('r1');
  });

  it('invalidate forces a refresh; a failed refresh asks the person to sign in again', async () => {
    const { p, oauth } = setup();
    await p.signIn();
    p.invalidate?.();
    expect(await p.getAccessToken()).toBe('a2');
    (oauth.refresh as jest.Mock).mockRejectedValueOnce(new Error('revoked'));
    p.invalidate?.();
    await expect(p.getAccessToken()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('cancelling the consent screen is not an error; sign-out forgets the tokens', async () => {
    const { p, oauth, secure } = setup();
    (oauth.authorize as jest.Mock).mockResolvedValueOnce(null);
    expect(await p.signIn()).toBe(false);
    expect(await p.isSignedIn()).toBe(false);
    await p.signIn();
    expect(await p.isSignedIn()).toBe(true);
    await p.signOut();
    expect(await secure.get(GOOGLE_TOKEN_KEY)).toBeNull();
    expect(await p.isSignedIn()).toBe(false);
  });
});
