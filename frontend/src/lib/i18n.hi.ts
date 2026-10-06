/**
 * Hindi bundle (skeleton). Only a handful of keys are translated to prove the mechanism; any key
 * not listed here falls back to English. Import this file once (App.tsx does) to register it,
 * then call setLocale('hi'). Devanagari is written as escapes so the source stays ASCII.
 */
import { registerBundle } from './i18n';

export const hi = {
  tabs: {
    home: '\u0939\u094B\u092E',
    money: '\u092A\u0948\u0938\u093E',
    goals: '\u0932\u0915\u094D\u0937\u094D\u092F',
    you: '\u0906\u092A',
  },
  money: {
    summary: '\u0938\u093E\u0930\u093E\u0902\u0936',
    entries: '\u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F\u092F\u093E\u0901',
  },
  privacy: {
    onDevice: '\u092F\u0939 \u0938\u092C \u0907\u0938\u0940 \u092B\u093C\u094B\u0928 \u092E\u0947\u0902 \u0930\u0939\u0924\u093E \u0939\u0948\u0964',
  },
  common: {
    done: '\u0939\u094B \u0917\u092F\u093E',
    save: '\u0938\u0939\u0947\u091C\u0947\u0902',
    cancel: '\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902',
    back: '\u0935\u093E\u092A\u0938',
  },
  homeUi: {
    greeting: '\u0936\u0941\u092D \u0938\u0902\u0927\u094D\u092F\u093E, \u0930\u093E\u0939\u0941\u0932',
    netWorth: '\u0915\u0941\u0932 \u0938\u0902\u092A\u0924\u094D\u0924\u093F',
    ask: '\u092A\u0942\u091B\u0947\u0902',
    addEntry: '\u092A\u094D\u0930\u0935\u093F\u0937\u094D\u091F\u093F \u091C\u094B\u0921\u093C\u0947\u0902',
    arrangeTitle: '\u0939\u094B\u092E \u0938\u091C\u093E\u090F\u0901',
  },
  startUi: {
    startFresh: '\u0928\u090F \u0938\u093F\u0930\u0947 \u0938\u0947 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902',
    restore: '\u092C\u0948\u0915\u0905\u092A \u0938\u0947 \u0935\u093E\u092A\u0938 \u0932\u093E\u090F\u0901',
  },
  settingsUi: {
    title: '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938',
    themeSystem: '\u0938\u093F\u0938\u094D\u091F\u092E',
    themeLight: '\u0939\u0932\u094D\u0915\u093E',
    themeDark: '\u0917\u0939\u0930\u093E',
  },
};

registerBundle('hi', hi);
