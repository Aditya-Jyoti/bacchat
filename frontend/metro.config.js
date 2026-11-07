// Metro config for the app bundle.
// The WASM libsodium build (libsodium-wrappers-sumo) is only for Node and Jest; on a phone the
// native react-native-libsodium binding is used (src/services/sodium.ts). Metro still follows the
// require in src/lib/sync/sodiumNode.ts, and the WASM build imports node:fs, which breaks the
// bundle. So on Android and iOS the WASM package resolves to an empty module.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const NODE_ONLY = new Set(['libsodium-wrappers-sumo', 'libsodium-sumo']);
const NATIVE = new Set(['android', 'ios']);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NATIVE.has(platform) && NODE_ONLY.has(moduleName)) return { type: 'empty' };
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
