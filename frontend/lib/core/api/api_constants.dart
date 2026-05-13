// Base URL is injected at build time via --dart-define=BASE_URL=...
// Dev default falls back to local LAN IP for ADB testing.
const String kBaseUrl = String.fromEnvironment(
  'BASE_URL',
  defaultValue: 'http://192.168.2.166:3000/v1',
);
const String kTokenKey = 'auth_token';
