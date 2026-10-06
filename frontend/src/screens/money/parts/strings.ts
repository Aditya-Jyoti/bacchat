/**
 * UI text for the Money tab screens (k3 to k9, k19, k27, k28). The text itself lives in the
 * shared i18n bundle under `moneyUi`; S reads it through t() on every access, so it follows
 * the current locale. The rupee sign is written as an escape.
 */
import { en, t } from '../../../lib/i18n';

export const R = '\u20B9';

type MoneyUiKey = keyof typeof en.moneyUi;

function view(): { readonly [K in MoneyUiKey]: string } {
  const out = {} as { [K in MoneyUiKey]: string };
  for (const key of Object.keys(en.moneyUi) as MoneyUiKey[]) {
    Object.defineProperty(out, key, { enumerable: true, get: () => t(`moneyUi.${key}`) });
  }
  return out;
}

export const S = view();

/** Fill {name} placeholders. */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
