// Base URL is injected at build time via --dart-define=BASE_URL=...
// The default points to production so a release APK built without the flag
// still works against the deployed backend.
const String kBaseUrl = String.fromEnvironment(
  'BASE_URL',
  defaultValue: 'https://bacchat.omrin.in/v1',
);

// Public host used in shareable invite links. Always production — invite links
// must work for anyone, including someone who has the app pointed at a dev
// backend. Override with --dart-define=INVITE_HOST=... if needed.
const String kInviteHost = String.fromEnvironment(
  'INVITE_HOST',
  defaultValue: 'https://bacchat.omrin.in',
);

const String kTokenKey = 'auth_token';
