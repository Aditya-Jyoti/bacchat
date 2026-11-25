/**
 * "Your month in plain words": three or four short lines that say what the month's numbers mean
 * and what to do next, built from the Summary data and the card bill. Pure, so every sentence is
 * tested. Calm wording: no alarms, a next step where there is one.
 */
import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';

export type StoryAction = { kind: 'accounts' } | { kind: 'category'; name: string } | { kind: 'entries' };
export type StoryLine = { key: string; icon: string; text: string; action?: StoryAction; actionLabel?: string };

export type StoryInput = {
  isCurrent: boolean;
  monthName: string;
  prevShort: string;
  spentPaise: number;
  inPaise: number;
  daysElapsed: number;
  lastMonthToDatePaise: number;
  /** Biggest category first. */
  top: { name: string; paise: number; share: number; deltaPaise: number } | null;
  oneOffPaise: number;
  oneOffCount: number;
  everydayPaise: number;
  /** The next card bill still to pay, and what is free in bank and cash accounts (outside goals). */
  bill: { cardName: string; leftPaise: number; dueLabel: string } | null;
  freePaise: number;
};

/** Whole rupees: the story reads easier without paise. */
const R = (p: number): string => formatRupees(Math.round(p / 100) * 100);

export function buildStory(s: StoryInput): StoryLine[] {
  const lines: StoryLine[] = [];
  if (s.spentPaise <= 0 && s.inPaise <= 0) return lines;
  const perDay = s.daysElapsed > 0 ? s.spentPaise / s.daysElapsed : 0;

  // 1. Pace, compared fairly with the same days of last month.
  if (s.isCurrent && s.lastMonthToDatePaise > 0) {
    const diff = s.spentPaise - s.lastMonthToDatePaise;
    const key = Math.abs(diff) < s.lastMonthToDatePaise * 0.05 ? 'storyPaceSame' : diff < 0 ? 'storyPaceLess' : 'storyPaceMore';
    lines.push({ key: 'pace', icon: 'speed', text: t(`moneyLive.${key}`, { spent: R(s.spentPaise), days: s.daysElapsed, perDay: R(perDay), diff: R(Math.abs(diff)), month: s.prevShort }) });
  } else {
    lines.push({ key: 'pace', icon: 'speed', text: t(s.isCurrent ? 'moneyLive.storyPaceNew' : 'moneyLive.storyPacePast', { spent: R(s.spentPaise), days: s.daysElapsed, perDay: R(perDay), month: s.monthName }) });
  }

  // 2. What drove it.
  if (s.top && s.top.share >= 0.2) {
    lines.push({
      key: 'top',
      icon: 'donut_large',
      text: t('moneyLive.storyTop', { name: s.top.name, amount: R(s.top.paise), share: Math.round(s.top.share * 100) }),
      action: { kind: 'category', name: s.top.name },
      actionLabel: t('moneyLive.storySee', { name: s.top.name }),
    });
  }

  // 3. Everyday spending without the big one-offs.
  if (s.oneOffCount > 0 && s.everydayPaise > 0 && s.daysElapsed > 0) {
    lines.push({
      key: 'everyday',
      icon: 'coffee',
      text: t(s.oneOffCount === 1 ? 'moneyLive.storyEverydayOne' : 'moneyLive.storyEveryday', { n: s.oneOffCount, big: R(s.oneOffPaise), everyday: R(s.everydayPaise), perDay: R(s.everydayPaise / s.daysElapsed) }),
    });
  }

  // 4. The card bill against money that is free to pay it.
  if (s.bill && s.bill.leftPaise > 0) {
    const short = s.bill.leftPaise - s.freePaise;
    lines.push({
      key: 'bill',
      icon: 'receipt_long',
      text:
        short > 0
          ? t('moneyLive.storyBillShort', { card: s.bill.cardName, amount: R(s.bill.leftPaise), date: s.bill.dueLabel, free: R(s.freePaise), short: R(short) })
          : t('moneyLive.storyBillOk', { card: s.bill.cardName, amount: R(s.bill.leftPaise), date: s.bill.dueLabel, free: R(s.freePaise) }),
      action: { kind: 'accounts' },
      actionLabel: t('moneyLive.storyAccounts'),
    });
  }
  return lines;
}
