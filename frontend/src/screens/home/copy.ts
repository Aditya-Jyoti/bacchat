/**
 * Home copy that the design hard-codes (the rest comes from src/data). The text lives in the
 * shared i18n bundle under `homeUi`; strings here are read through t() on every access.
 * Amounts that are sample data keep their rupee escapes in the bundle.
 */
import { t } from '../../lib/i18n';

const h = (key: string): string => t(`homeUi.${key}`);

export const homeCopy = {
  get today() { return h('today'); },
  get greeting() { return h('greeting'); },
  get initial() { return h('initial'); },
  get ask() { return h('ask'); },
  get netWorth() { return h('netWorth'); },
  get since() { return h('since'); },
  get own() { return h('own'); },
  get owe() { return h('owe'); },
  ranges: ['1M', '6M', '1Y', 'All'] as const,
  get privacy() { return h('privacy'); },
  get insight() { return h('insight'); },
  spendable: {
    get name() { return h('spendableName'); },
    get sub() { return h('spendableSub'); },
    amount: '\u20B95,23,150',
    icon: 'account_balance_wallet',
  },
  dues: {
    get name() { return h('duesName'); },
    get sub() { return h('duesSub'); },
    amount: '\u20B920,000',
    icon: 'credit_card',
  },
  get spentSuffix() { return h('spentSuffix'); },
  get budgetLeft() { return h('budgetLeft'); },
  get daysLeft() { return h('daysLeft'); },
  budgetFill: 0.69,
  budgetToday: 0.77,
  get addEntry() { return h('addEntry'); },
};
