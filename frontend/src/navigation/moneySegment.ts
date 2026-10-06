import { create } from 'zustand';

export type MoneySegment = 'summary' | 'entries';

/** Money remembers whether you were last on Summary or Entries. Persisted locally later. */
export const useMoneySegment = create<{ last: MoneySegment; setLast: (s: MoneySegment) => void }>((set) => ({
  last: 'summary',
  setLast: (last) => set({ last }),
}));
