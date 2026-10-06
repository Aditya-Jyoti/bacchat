import type React from 'react';

import K10 from '../screens/you/K10_Accounts';
import K11 from '../screens/you/K11_AddAccount';
import K12 from '../screens/goals/K12_Goals';
import K13 from '../screens/goals/K13_GoalDetail';
import K14 from '../screens/goals/K14_NewGoal';
import K15 from '../screens/you/K15_Budget';
import K16 from '../screens/you/K16_EditBudget';
import K17 from '../screens/you/K17_ComingUp';
import K18 from '../screens/home/K18_Ask';
import K19 from '../screens/money/K19_Search';
import K1 from '../screens/home/K1_Home';
import K20 from '../screens/debug/K20_ComponentSheet1';
import K21 from '../screens/start/K21_Splash';
import K22 from '../screens/start/K22_Welcome';
import K23 from '../screens/you/K23_You';
import K24 from '../screens/you/K24_Settings';
import K25 from '../screens/you/K25_BackupSync';
import K26 from '../screens/you/K26_Syncing';
import K27 from '../screens/money/K27_LongPressMenu';
import K28 from '../screens/money/K28_SelectMode';
import K29 from '../screens/debug/K29_ComponentSheet2';
import K2 from '../screens/home/K2_ArrangeHome';
import K3 from '../screens/money/K3_MoneySummary';
import K4 from '../screens/money/K4_MoneyEntries';
import K5 from '../screens/money/K5_AddEntry';
import K6 from '../screens/money/K6_DatePicker';
import K7 from '../screens/money/K7_ReadingScreenshot';
import K8 from '../screens/money/K8_ScreenshotReview';
import K9 from '../screens/money/K9_ResolveConflict';
import { MANIFEST_BY_KID, type KId, type ScreenDef } from './screenManifest';

/** k-id to screen component. Screen agents replace the files, not this map. */
export const SCREEN_COMPONENTS: Readonly<Record<KId, React.ComponentType>> = {
  k1: K1, k2: K2, k3: K3, k4: K4, k5: K5, k6: K6, k7: K7, k8: K8, k9: K9, k10: K10,
  k11: K11, k12: K12, k13: K13, k14: K14, k15: K15, k16: K16, k17: K17, k18: K18, k19: K19, k20: K20,
  k21: K21, k22: K22, k23: K23, k24: K24, k25: K25, k26: K26, k27: K27, k28: K28, k29: K29,
};

export type RegisteredScreen = ScreenDef & { component: React.ComponentType };

export const REGISTERED_SCREENS: readonly RegisteredScreen[] = (Object.keys(SCREEN_COMPONENTS) as KId[]).map((kid) => ({
  ...MANIFEST_BY_KID[kid],
  component: SCREEN_COMPONENTS[kid],
}));
