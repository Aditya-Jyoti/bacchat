/**
 * Entry points that arrive from outside the app (an image shared into Bacchat) wait here until the
 * app can show them: navigation is ready and the splash and welcome screens are done. The navigator
 * then opens the screen and clears the entry. This avoids the app sending a link to itself, which was
 * lost when it arrived during the splash screen.
 */
import { create } from 'zustand';

export type PendingEntry = { route: string; params?: Record<string, unknown> };

type State = { entry: PendingEntry | null; set: (e: PendingEntry | null) => void };

export const usePendingEntry = create<State>((set) => ({
  entry: null,
  set: (entry) => set({ entry }),
}));

/** Routes that must finish before a pending entry opens (splash and first-run welcome). */
export const HOLD_ROUTES: readonly string[] = ['splash', 'welcome'];
