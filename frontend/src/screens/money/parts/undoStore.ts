import { create } from 'zustand';

import type { Entry } from '../../../data/db';

/**
 * A delete that can still be undone. K27 and K28 write it, K4 and K28 show the snackbar.
 * Holds the removed entries, so Undo puts them back exactly as they were.
 */
export type UndoItem = { label: string; entries: Entry[] };

type UndoState = {
  item: UndoItem | null;
  set: (item: UndoItem | null) => void;
};

export const useUndo = create<UndoState>((set) => ({ item: null, set: (item) => set({ item }) }));
