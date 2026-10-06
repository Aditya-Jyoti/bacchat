import { create } from 'zustand';

/** Whether the welcome has been shown. In-memory for now; persistence arrives with the key-value store. */
export const useFirstRun = create<{ seen: boolean; markSeen: () => void }>((set) => ({
  seen: false,
  markSeen: () => set({ seen: true }),
}));
