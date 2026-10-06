/** Optional AI wording for the Home insight card; rules text stays the fallback. No network. */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { clearInsightCache, duesFacts, useAiInsightText } from '../aiInsight';
import type { DuesInsight } from '../liveData';

const mockAi = { router: { available: jest.fn() }, insight: jest.fn() };
jest.mock('../../../services', () => ({ useServices: () => ({ ai: mockAi }) }));

const D: DuesInsight = { count: 2, totalPaise: 12_400_00, days: 5, bankName: 'HDFC Savings', bankPaise: 50_000_00 };

beforeEach(() => {
  clearInsightCache();
  mockAi.router.available.mockReset();
  mockAi.insight.mockReset();
});

describe('duesFacts', () => {
  it('sends totals only, no names', () => {
    const f = duesFacts(D);
    expect(f).toEqual({ cardBillsDue: 2, cardBillsTotalRupees: 12400, daysUntilLastDue: 5, bankBalanceRupees: 50000 });
    expect(JSON.stringify(f)).not.toContain('HDFC');
  });
});

describe('useAiInsightText', () => {
  it('returns the AI text when an engine is ready', async () => {
    mockAi.router.available.mockResolvedValue(true);
    mockAi.insight.mockResolvedValue({ text: 'Two card bills, \u20B912,400, fall due within 5 days.' });
    const { result } = renderHook(() => useAiInsightText(D));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toContain('12,400'));
    expect(mockAi.insight).toHaveBeenCalledWith(duesFacts(D));
  });

  it('stays null (rules text) with no engine, and never calls the model', async () => {
    mockAi.router.available.mockResolvedValue(false);
    const { result } = renderHook(() => useAiInsightText(D));
    await act(async () => undefined);
    expect(result.current).toBeNull();
    expect(mockAi.insight).not.toHaveBeenCalled();
  });

  it('stays null when the answer is refused or the call throws, and asks once per facts', async () => {
    mockAi.router.available.mockResolvedValue(true);
    mockAi.insight.mockRejectedValue(new Error('x'));
    const a = renderHook(() => useAiInsightText(D));
    await act(async () => undefined);
    expect(a.result.current).toBeNull();
    const b = renderHook(() => useAiInsightText(D));
    await act(async () => undefined);
    expect(b.result.current).toBeNull();
    expect(mockAi.insight).toHaveBeenCalledTimes(1);
  });

  it('does nothing without dues', async () => {
    const { result } = renderHook(() => useAiInsightText(null));
    await act(async () => undefined);
    expect(result.current).toBeNull();
    expect(mockAi.router.available).not.toHaveBeenCalled();
  });
});
