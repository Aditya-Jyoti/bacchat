export type NavRecord = {
  /** AMFI scheme code, or NPS scheme id. */
  schemeCode: string;
  isinPayout: string | null;
  isinReinvest: string | null;
  name: string;
  /** NAV in rupees times 1e6. */
  navMicro: number;
  /** Date of the NAV as YYYY-MM-DD. */
  date: string;
  /** AMFI scheme category line, when present. */
  category?: string;
  /** Fund house line, when present. */
  amc?: string;
};

export type NavTable = {
  source: 'amfi' | 'nps';
  records: NavRecord[];
  byCode: Map<string, NavRecord>;
};

export type NavFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; credentials?: 'omit' | 'same-origin' | 'include' },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type NavErrorCode = 'offline' | 'http' | 'parse';

export class NavError extends Error {
  constructor(
    public code: NavErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'NavError';
  }
}
