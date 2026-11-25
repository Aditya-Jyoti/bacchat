/** @jest-environment node */
import { buildStory, type StoryInput } from '../summary/story';
import { changeWords } from '../summary/CategorySection';

const base: StoryInput = {
  isCurrent: true,
  monthName: 'November',
  prevShort: 'Oct',
  spentPaise: 75_753_97,
  inPaise: 49_000_00,
  daysElapsed: 26,
  lastMonthToDatePaise: 60_000_00,
  top: { name: 'Travel', paise: 27_651_96, share: 0.37, deltaPaise: 20_000_00 },
  oneOffPaise: 40_000_00,
  oneOffCount: 6,
  everydayPaise: 35_753_97,
  bill: { cardName: 'Slice Credit', leftPaise: 69_270_09, dueLabel: '9 Dec' },
  freePaise: 17_640_00,
};

describe('buildStory', () => {
  it('says the pace, what drove it, everyday spending and whether the bill is covered', () => {
    const lines = buildStory(base);
    expect(lines.map((l) => l.key)).toEqual(['pace', 'top', 'everyday', 'bill']);
    expect(lines[0].text).toBe('You have spent \u20B975,754 in 26 days, about \u20B92,914 a day. That is \u20B915,754 more than by this point in Oct.');
    expect(lines[1].text).toBe('Travel took the biggest share: \u20B927,652, 37% of everything.');
    expect(lines[1].action).toEqual({ kind: 'category', name: 'Travel' });
    expect(lines[2].text).toBe('6 big payments of \u20B940,000 explain a lot of it. Without them, everyday spending is \u20B935,754, about \u20B91,375 a day.');
    expect(lines[3].text).toBe('Your Slice Credit bill of \u20B969,270 is due 9 Dec. You have \u20B917,640 free outside your goals, so \u20B951,630 more is needed. Salary, or money moved from a goal, can cover it.');
    expect(lines[3].action).toEqual({ kind: 'accounts' });
  });

  it('is calm when the bill is covered and when spending is below last month', () => {
    const lines = buildStory({ ...base, spentPaise: 40_000_00, everydayPaise: 0, oneOffCount: 0, freePaise: 1_00_000_00 });
    expect(lines[0].text).toContain('less than by this point in Oct');
    expect(lines.find((l) => l.key === 'bill')?.text).toContain('enough to pay it');
    expect(lines.some((l) => l.key === 'everyday')).toBe(false);
  });

  it('a past month speaks in the past, without a bill line', () => {
    const lines = buildStory({ ...base, isCurrent: false, daysElapsed: 31, bill: null, monthName: 'October' });
    expect(lines[0].text).toBe('You spent \u20B975,754 in October, about \u20B92,444 a day.');
    expect(lines.some((l) => l.key === 'bill')).toBe(false);
  });

  it('says nothing for an empty month', () => {
    expect(buildStory({ ...base, spentPaise: 0, inPaise: 0 })).toEqual([]);
  });
});

describe('changeWords', () => {
  it('puts the change versus last month in words', () => {
    expect(changeWords(2_738_91, 9_040_00, 'Oct')).toBe('\u20B92,738.91 more than Oct');
    expect(changeWords(-2_680_73, 11_611_72, 'Oct')).toBe('\u20B92,680.73 less than Oct');
    expect(changeWords(0, 100, 'Oct')).toBe('Same as Oct');
    expect(changeWords(6_988_00, 0, 'Oct')).toBe('Nothing here in Oct');
  });
});
