import { formatRupees } from '../../lib/format';
import {
  allocation,
  budgets,
  dailyAverage,
  dailySpendRupees,
  dailyTooltip,
  entryDays,
  goals,
  m,
  netWorth,
  screenshotRows,
  sectionMeta,
  spend,
  spendTotal,
  upcoming,
} from '../sampleData';
import {
  defaultHomeConfig,
  deserializeHomeConfig,
  moveSection,
  normalizeHomeConfig,
  serializeHomeConfig,
  setSectionEnabled,
  useHomeConfig,
  visibleSections,
} from '../homeConfig';

describe('sample data', () => {
  it('parses display text to paise', () => {
    expect(m('\u20B96,640').paise).toBe(664000);
    expect(m('+\u20B9899').paise).toBe(89900);
    expect(m('-\u20B91,120').paise).toBe(-112000);
  });

  it('keeps display text in step with paise via formatRupees', () => {
    const all = [
      netWorth.net, netWorth.own, netWorth.owe, spendTotal,
      ...spend.map((s) => s.amount),
      ...allocation.map((a) => a.amount),
      ...entryDays.flatMap((d) => [d.total, ...d.items.map((i) => i.amount)]),
      ...upcoming.map((u) => u.amount),
      ...goals.flatMap((g) => [g.saved, g.target]),
      ...budgets.flatMap((b) => [b.spent, b.limit]),
    ];
    for (const money of all) {
      expect(formatRupees(money.paise, { plus: money.text.startsWith('+') })).toBe(money.text);
    }
  });

  it('net worth is own minus owe', () => {
    expect(netWorth.net.paise).toBe(netWorth.own.paise - netWorth.owe.paise);
  });

  it('category spend adds to the total', () => {
    expect(spend.reduce((a, s) => a + s.amount.paise, 0)).toBe(spendTotal.paise);
  });

  it('daily spend has 24 days and the design average', () => {
    expect(dailySpendRupees).toHaveLength(24);
    expect(Math.max(...dailySpendRupees)).toBe(2964);
    expect(dailyAverage.paise).toBe(130200);
  });

  it('day tooltip follows the design rule', () => {
    expect(dailyTooltip(21).top[0].name).toBe('BESCOM');
    expect(dailyTooltip(23).entries).toBe(2 + ((23 * 5) % 7) + 3);
    expect(dailyTooltip(16).vsAverage.text).toBe('+\u20B91,588');
    expect(dailyTooltip(0).top).toHaveLength(2);
  });

  it('has the screenshot statuses and 7 entries today', () => {
    expect(screenshotRows.filter((r) => r.status === 'match')).toHaveLength(1);
    expect(screenshotRows.filter((r) => r.status === 'conflict')).toHaveLength(1);
    expect(entryDays[0].items).toHaveLength(7);
    expect(Object.keys(sectionMeta)).toHaveLength(6);
  });
});

describe('home config', () => {
  it('defaults to the design order, all on', () => {
    const c = defaultHomeConfig();
    expect(c.map((s) => s.id)).toEqual(['insight', 'accounts', 'spend', 'upcoming', 'goals', 'budget']);
    expect(c.every((s) => s.enabled)).toBe(true);
  });
  it('moves and hides', () => {
    let c = moveSection(defaultHomeConfig(), 0, 2);
    expect(c.map((s) => s.id).slice(0, 3)).toEqual(['accounts', 'spend', 'insight']);
    c = setSectionEnabled(c, 'spend', false);
    expect(visibleSections(c)).not.toContain('spend');
    expect(moveSection(c, 0, 99)).toBe(c);
  });
  it('serialises and repairs bad input', () => {
    const c = setSectionEnabled(defaultHomeConfig(), 'goals', false);
    expect(deserializeHomeConfig(serializeHomeConfig(c))).toEqual(c);
    expect(deserializeHomeConfig('not json')).toEqual(defaultHomeConfig());
    expect(deserializeHomeConfig(null)).toEqual(defaultHomeConfig());
    const fixed = normalizeHomeConfig([{ id: 'goals', enabled: false }, { id: 'goals' }, { id: 'zzz' }, 5]);
    expect(fixed[0]).toEqual({ id: 'goals', enabled: false });
    expect(fixed).toHaveLength(6);
  });
  it('store updates', () => {
    useHomeConfig.getState().reset();
    useHomeConfig.getState().setEnabled('budget', false);
    useHomeConfig.getState().move(5, 0);
    expect(useHomeConfig.getState().config[0].id).toBe('budget');
    useHomeConfig.getState().hydrate(null);
    expect(useHomeConfig.getState().config).toEqual(defaultHomeConfig());
  });
});
