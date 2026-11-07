/**
 * Lite build: BACCHAT_LITE=1 leaves the on-device AI engine (llama.rn, about 75 MB of native code)
 * out of the Android app. The JS side already treats a missing engine as "not available in this
 * build" (modules/bacchat-llm), so nothing else changes. See docs/decisions.md.
 */
const lite = process.env.BACCHAT_LITE === '1';

module.exports = {
  dependencies: lite ? { 'llama.rn': { platforms: { android: null, ios: null } } } : {},
};
