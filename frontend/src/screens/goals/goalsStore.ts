import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { goalAllocation, goals as sampleGoals, colorKeyToRole, m } from '../../data';
import type { ColorKey } from '../../data';
import { persistStorage, registerPersisted } from '../../lib/persistence';

/** One account's share of a goal, in paise. */
export type GoalAlloc = { from: string; icon: string; paise: number; color: ColorKey };

export type GoalState = {
  id: string;
  name: string;
  icon: string;
  savedPaise: number;
  targetPaise: number;
  by: string;
  allocations: GoalAlloc[];
};

const STEP = 50000;

/** Spread a saved amount across the sample accounts in the sample proportions, in rupee-500 steps. */
function spread(savedPaise: number): GoalAlloc[] {
  const base = goalAllocation.reduce((a, g) => a + g.amount.paise, 0);
  const out = goalAllocation.map((g) => ({
    from: g.from,
    icon: g.icon,
    color: g.color,
    paise: Math.floor((savedPaise * g.amount.paise) / base / STEP) * STEP,
  }));
  out[0].paise += savedPaise - out.reduce((a, g) => a + g.paise, 0);
  return out;
}

const seed = (id: string, name: string, icon: string, saved: number, target: number, by: string): GoalState => ({
  id,
  name,
  icon,
  savedPaise: saved,
  targetPaise: target,
  by,
  allocations: spread(saved),
});

/** The four sample goals plus two finished ones, so the Done tab matches the design count. */
export function initialGoals(): GoalState[] {
  const active = sampleGoals.map((g, i) => seed(`g${i}`, g.name, g.icon, g.saved.paise, g.target.paise, g.by));
  const goa = active[0];
  goa.allocations = goalAllocation.map((g) => ({ from: g.from, icon: g.icon, color: g.color, paise: g.amount.paise }));
  return [
    ...active,
    seed('d0', 'New phone', 'smartphone', m('\u20B930,000').paise, m('\u20B930,000').paise, 'done in March'),
    seed('d1', 'Jaipur weekend', 'flight', m('\u20B918,000').paise, m('\u20B918,000').paise, 'done in July'),
  ];
}

export const isReached = (g: GoalState): boolean => g.savedPaise >= g.targetPaise;

type Store = {
  goals: GoalState[];
  /** Replace the per-account split; saved becomes the sum. */
  setAllocations: (id: string, allocations: GoalAlloc[]) => void;
  /** Positive adds to the first account, negative takes from the last accounts first. */
  adjust: (id: string, deltaPaise: number) => void;
  addGoal: (g: Omit<GoalState, 'id'>) => string;
  reset: () => void;
};

export const useGoals = registerPersisted(
  create<Store>()(
    persist(
      (set) => ({
        goals: initialGoals(),
        setAllocations: (id, allocations) =>
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === id ? { ...g, allocations, savedPaise: allocations.reduce((a, x) => a + x.paise, 0) } : g,
            ),
          })),
        adjust: (id, delta) =>
          set((s) => ({
            goals: s.goals.map((g) => {
              if (g.id !== id) return g;
              const allocations = g.allocations.map((a) => ({ ...a }));
              if (delta >= 0) allocations[0].paise += delta;
              else {
                let left = -delta;
                for (let i = allocations.length - 1; i >= 0 && left > 0; i--) {
                  const take = Math.min(left, allocations[i].paise);
                  allocations[i].paise -= take;
                  left -= take;
                }
              }
              return { ...g, allocations, savedPaise: allocations.reduce((a, x) => a + x.paise, 0) };
            }),
          })),
        addGoal: (g) => {
          const id = `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
          set((s) => ({ goals: [{ ...g, id }, ...s.goals] }));
          return id;
        },
        reset: () => set({ goals: initialGoals() }),
      }),
      {
        name: 'bacchat.goals',
        version: 1,
        storage: persistStorage<{ goals: GoalState[] }>(),
        partialize: (s) => ({ goals: s.goals }),
        merge: (persisted, current) => {
          const goals = (persisted as { goals?: unknown } | undefined)?.goals;
          return {
            ...current,
            goals: Array.isArray(goals) && goals.length > 0 ? (goals as GoalState[]) : current.goals,
          };
        },
      },
    ),
  ),
);

export const roleOfColorKey = colorKeyToRole;
