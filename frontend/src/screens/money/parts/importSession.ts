import { create } from 'zustand';

import type { ScreenRow } from '../../../lib/ingest';
import type { Choice, LoadedPlan } from '../importFlow';

/**
 * The screenshot import in progress, shared by k7 (reads), k8 (reviews) and k9 (resolves one
 * conflict). In memory only: closing the app drops it, which is fine for a short flow.
 */
type Session = {
  rows: ScreenRow[] | null;
  uri: string | null;
  plan: LoadedPlan | null;
  /** Conflict row index to the resolution picked in k9. */
  resolutions: Record<number, { choice: Choice; trust: boolean }>;
  /** Conflict row k9 is working on (set by k8 before it opens k9). */
  active: number | null;
  setActive: (index: number | null) => void;
  start: (rows: ScreenRow[], uri: string | null) => void;
  setPlan: (plan: LoadedPlan | null) => void;
  resolve: (index: number, choice: Choice, trust: boolean) => void;
  reset: () => void;
};

export const useImportSession = create<Session>((set) => ({
  rows: null,
  uri: null,
  plan: null,
  resolutions: {},
  active: null,
  setActive: (active) => set({ active }),
  start: (rows, uri) => set({ rows, uri, plan: null, resolutions: {}, active: null }),
  setPlan: (plan) => set({ plan }),
  resolve: (index, choice, trust) => set((s) => ({ resolutions: { ...s.resolutions, [index]: { choice, trust } } })),
  reset: () => set({ rows: null, uri: null, plan: null, resolutions: {}, active: null }),
}));
