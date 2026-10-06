import { create } from 'zustand';

import type { HomeSectionId } from './types';

/** Net worth is pinned first and is not part of this list. */
export type HomeSectionConfig = { id: HomeSectionId; enabled: boolean };
export type HomeConfig = HomeSectionConfig[];

export const defaultHomeOrder: readonly HomeSectionId[] = ['insight', 'accounts', 'spend', 'upcoming', 'goals', 'budget'];

export function defaultHomeConfig(): HomeConfig {
  return defaultHomeOrder.map((id) => ({ id, enabled: true }));
}

export function moveSection(config: HomeConfig, from: number, to: number): HomeConfig {
  if (from === to || from < 0 || to < 0 || from >= config.length || to >= config.length) return config;
  const next = config.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setSectionEnabled(config: HomeConfig, id: HomeSectionId, enabled: boolean): HomeConfig {
  return config.map((s) => (s.id === id ? { ...s, enabled } : s));
}

export function visibleSections(config: HomeConfig): HomeSectionId[] {
  return config.filter((s) => s.enabled).map((s) => s.id);
}

/** Repair stored data: drop unknown ids and duplicates, append missing sections enabled. */
export function normalizeHomeConfig(input: unknown): HomeConfig {
  const known = new Set<string>(defaultHomeOrder);
  const seen = new Set<string>();
  const out: HomeConfig = [];
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (raw && typeof raw === 'object') {
        const { id, enabled } = raw as { id?: unknown; enabled?: unknown };
        if (typeof id === 'string' && known.has(id) && !seen.has(id)) {
          seen.add(id);
          out.push({ id: id as HomeSectionId, enabled: enabled !== false });
        }
      }
    }
  }
  for (const id of defaultHomeOrder) if (!seen.has(id)) out.push({ id, enabled: true });
  return out;
}

export function serializeHomeConfig(config: HomeConfig): string {
  return JSON.stringify(config);
}

export function deserializeHomeConfig(json: string | null | undefined): HomeConfig {
  if (!json) return defaultHomeConfig();
  try {
    return normalizeHomeConfig(JSON.parse(json));
  } catch {
    return defaultHomeConfig();
  }
}

type HomeConfigState = {
  config: HomeConfig;
  move: (from: number, to: number) => void;
  setEnabled: (id: HomeSectionId, enabled: boolean) => void;
  reset: () => void;
  /** Replace from persisted JSON (key-value store wiring comes later). */
  hydrate: (json: string | null | undefined) => void;
};

export const useHomeConfig = create<HomeConfigState>((set) => ({
  config: defaultHomeConfig(),
  move: (from, to) => set((s) => ({ config: moveSection(s.config, from, to) })),
  setEnabled: (id, enabled) => set((s) => ({ config: setSectionEnabled(s.config, id, enabled) })),
  reset: () => set({ config: defaultHomeConfig() }),
  hydrate: (json) => set({ config: deserializeHomeConfig(json) }),
}));
