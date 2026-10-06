import { parseSms } from '../sms';
import { amountToPaise, stripBalances } from '../money';
import { findDate, findTime, messageTime } from '../datetime';
import { cleanMerchant, merchantFromVpa } from '../merchantText';

const RX = new Date(2026, 9, 24, 21, 30).getTime();
const at = (d: number, mo: number, y: number, h?: number, mi?: number): number =>
  h == null ? new Date(y, mo - 1, d, 21, 30).getTime() : new Date(y, mo - 1, d, h, mi ?? 0).getTime();

type Expect = {
  paise: number;
  dir: 'out' | 'in';
  merchant: string | null;
  method?: string | null;
  card?: string | null;
  acct?: string | null;
  ref?: string | null;
  bal?: number | null;
  vpa?: string | null;
  timeKnown?: boolean;
  atMs?: number;
};

const CASES: [string, string, Expect][] = [
  [
    'HDFC UPI sent',
    'Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210 Not You? Call 18002586161',
    { paise: 48600, dir: 'out', merchant: 'Swiggy', method: 'upi', acct: '4021', ref: '429876543210' },
  ],
  [
    'HDFC UPI to VPA',
    'Rs.2315.00 debited from A/c XX4021 on 23-10-26 to VPA bigbasket@hdfcbank(UPI Ref No 429812345670). Not you? Call 18002586161',
    { paise: 231500, dir: 'out', merchant: 'Bigbasket', method: 'upi', acct: '4021', ref: '429812345670', vpa: 'bigbasket@hdfcbank', atMs: at(23, 10, 2026, 12, 0) },
  ],
  [
    'HDFC credit for refund',
    'Rs.899.00 credited to HDFC Bank A/c XX4021 on 23-10-26 by VPA myntra@axisbank (UPI Ref No 429800000001)',
    { paise: 89900, dir: 'in', merchant: 'Myntra', method: 'upi', acct: '4021', ref: '429800000001' },
  ],
  [
    'SBI UPI debit',
    'Dear UPI user A/C X1234 debited by 150.0 on date 24Oct26 trf to RAMESH FRUITS Refno 429812345678 If not u? call 1800111109. -SBI',
    { paise: 15000, dir: 'out', merchant: 'Ramesh Fruits', method: 'upi', acct: '1234', ref: '429812345678' },
  ],
  [
    'SBI salary credit with balance',
    'Your A/C XXXXXX5678 has a credit of Rs 1,26,000.00 on 01-10-26 by NEFT-ACME CORP-SALARY. Avl Bal Rs 3,62,400.50 -SBI',
    { paise: 12600000, dir: 'in', merchant: 'Acme Corp', acct: '5678', bal: 36240050 },
  ],
  [
    'ICICI credit card spend',
    'Rs 486.00 spent on ICICI Bank Card XX4005 on 24-Oct-26 at SWIGGY. Avl Limit: Rs 1,85,180.00. If not you, call 1800 1080.',
    { paise: 48600, dir: 'out', merchant: 'Swiggy', method: 'card', card: '4005', bal: null },
  ],
  [
    'ICICI Amazon Pay card',
    'INR 1,249.00 spent using ICICI Bank Card XX4005 on 24-Oct-26 on AMAZON PAY INDIA. Avl Limit: INR 1,85,000.00. If not you, call 18002662',
    { paise: 124900, dir: 'out', merchant: 'Amazon Pay India', card: '4005', method: 'card' },
  ],
  [
    'HDFC credit card',
    'Spent Rs.340 On HDFC Bank CREDIT Card xx8842 At MYNTRA On 2026-10-24:15:12:00 Not You? To Block+Reissue Call 18002586161',
    { paise: 34000, dir: 'out', merchant: 'Myntra', method: 'card', card: '8842', timeKnown: true, atMs: at(24, 10, 2026, 15, 12) },
  ],
  [
    'Axis debit UPI P2M with time and balance',
    'INR 1,200.00 debited from A/c no. XX1234 on 24-10-26 20:15:30 UPI/P2M/429876543299/Blinkit. Avl Bal INR 12,345.67 -Axis Bank',
    { paise: 120000, dir: 'out', merchant: 'Blinkit', method: 'upi', acct: '1234', ref: '429876543299', bal: 1234567, timeKnown: true, atMs: at(24, 10, 2026, 20, 15) },
  ],
  [
    'Kotak sent to VPA',
    'Sent Rs.89.00 from Kotak Bank AC X1234 to rapido@ybl on 24-10-26.UPI Ref 429812340001. Not you? Call 1800 266 0000',
    { paise: 8900, dir: 'out', merchant: 'Rapido', method: 'upi', acct: '1234', ref: '429812340001', vpa: 'rapido@ybl' },
  ],
  [
    'Payments app notification',
    'Paid Rs.280 to Third Wave Coffee using UPI. UPI Ref 429812340002',
    { paise: 28000, dir: 'out', merchant: 'Third Wave Coffee', method: 'upi', ref: '429812340002' },
  ],
  [
    'Rupee sign amount',
    '\u20B9500 paid to Mohan S via UPI on 24 Oct 2026 21:15. Ref 429812340003',
    { paise: 50000, dir: 'out', merchant: 'Mohan S', method: 'upi', ref: '429812340003', atMs: at(24, 10, 2026, 21, 15) },
  ],
  [
    'ATM withdrawal',
    'Rs.5,000 withdrawn from ATM using HDFC Bank Debit Card XX4021 on 20-10-26. Avl Bal Rs 2,07,400.00',
    { paise: 500000, dir: 'out', merchant: 'ATM withdrawal', method: 'debit', card: '4021', bal: 20740000 },
  ],
  [
    'Debit card POS',
    'Rs.2,150.00 spent on your HDFC Bank Debit Card ending 4021 at DMART RETAIL on 22-10-2026. Avl bal Rs 3,10,250.00',
    { paise: 215000, dir: 'out', merchant: 'Dmart Retail', method: 'debit', card: '4021', bal: 31025000 },
  ],
  [
    'Credit with amount in words order',
    'A/c XX4021 credited with Rs.42,300.00 on 09-Oct-26 by UPI from client@okaxis. Ref 429811110000',
    { paise: 4230000, dir: 'in', merchant: 'Client', method: 'upi', acct: '4021', ref: '429811110000' },
  ],
  [
    'Credit card bill payment received',
    'Payment of Rs 14,820.00 received on your ICICI Bank Credit Card XX4005 on 25-Oct-26. Thank you.',
    { paise: 1482000, dir: 'out', merchant: null, method: 'card', card: '4005' },
  ],
  [
    'Decimal with no paise and lakh grouping',
    'Rs 12,34,567 debited from A/c XX9999 on 05-10-26 towards HOME LOAN EMI. Avl Bal Rs 90,000.00',
    { paise: 123456700, dir: 'out', merchant: 'Home Loan Emi', acct: '9999', bal: 9000000 },
  ],
];

describe('parseSms table', () => {
  it.each(CASES)('%s', (_name, text, e) => {
    const c = parseSms(text, { receivedAt: RX });
    expect(c).not.toBeNull();
    expect(c!.amountPaise).toBe(e.paise);
    expect(Number.isInteger(c!.amountPaise)).toBe(true);
    expect(c!.direction).toBe(e.dir);
    expect(c!.merchant).toBe(e.merchant);
    expect(c!.source).toBe('sms');
    if (e.method !== undefined) expect(c!.method).toBe(e.method);
    if (e.card !== undefined) expect(c!.cardLast4).toBe(e.card);
    if (e.acct !== undefined) expect(c!.accountLast4).toBe(e.acct);
    if (e.ref !== undefined) expect(c!.upiRef).toBe(e.ref);
    if (e.bal !== undefined) expect(c!.balancePaise).toBe(e.bal);
    if (e.vpa !== undefined) expect(c!.upiHandle).toBe(e.vpa);
    if (e.timeKnown !== undefined) expect(c!.timeKnown).toBe(e.timeKnown);
    if (e.atMs !== undefined) expect(c!.at).toBe(e.atMs);
    expect(c!.confidence).toBeGreaterThan(0.5);
    expect(c!.confidence).toBeLessThanOrEqual(0.99);
  });
});

describe('parseSms rejects non-transactions', () => {
  it.each([
    ['OTP', '123456 is your OTP for transaction of Rs 486.00 at SWIGGY. Valid for 10 mins. Do not share.'],
    ['Bill due reminder', 'Your ICICI Bank Credit Card bill of Rs 14,820.00 is due on 31-Oct-26. Minimum amount due Rs 740.00.'],
    ['Future debit', 'Rs 3,000.00 will be debited from your A/c XX4021 on 25-Oct-26 for SIP mandate.'],
    ['Collect request', 'RAHUL has requested money Rs 500.00 from you on UPI. Open app to pay.'],
    ['Failed', 'Your UPI transaction of Rs 486.00 to SWIGGY has failed. Amount will be refunded if debited.'],
    ['Balance only', 'Your A/c XX4021 balance is Rs 3,12,400.00 as on 24-Oct-26.'],
    ['Promo', 'Get pre-approved personal loan up to Rs 5,00,000. Apply now.'],
    ['Empty', '   '],
    ['No amount', 'Your account has been debited. Please check your passbook.'],
    ['Chat', 'Hey, are we still meeting at 5 pm?'],
  ])('%s', (_n, text) => {
    expect(parseSms(text, { receivedAt: RX })).toBeNull();
  });
});

describe('parseSms details', () => {
  it('uses the received time when the text has no date', () => {
    const c = parseSms('Paid Rs.280 to Third Wave Coffee using UPI.', { receivedAt: RX })!;
    expect(c.at).toBe(RX);
    expect(c.timeKnown).toBe(false);
  });

  it('uses a time of day in the text with the received date', () => {
    const c = parseSms('Rs.280 debited from A/c XX4021 at 17:30 to Chai Point', { receivedAt: RX })!;
    expect(c.at).toBe(at(24, 10, 2026, 17, 30));
    expect(c.timeKnown).toBe(true);
  });

  it('dated yesterday with no time lands at noon and is time-unknown', () => {
    const c = parseSms('Rs.100 debited from A/c XX4021 on 23-10-26 to Auto Ride', { receivedAt: RX })!;
    expect(c.at).toBe(at(23, 10, 2026, 12, 0));
    expect(c.timeKnown).toBe(false);
  });

  it('keeps the SMS id as rawRef, else falls back to the UPI ref', () => {
    const a = parseSms('Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210', { receivedAt: RX, rawRef: 'sms-77' })!;
    expect(a.rawRef).toBe('sms-77');
    const b = parseSms('Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210', { receivedAt: RX })!;
    expect(b.rawRef).toBe('ref:429876543210');
    const c = parseSms('Paid Rs.280 to Third Wave Coffee using UPI.', { receivedAt: RX })!;
    expect(c.rawRef).toBeNull();
  });

  it('is more confident with a merchant, ref and account than with a bare amount', () => {
    const full = parseSms('Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210', { receivedAt: RX })!;
    const bare = parseSms('Rs 50 debited', { receivedAt: RX })!;
    expect(full.confidence).toBeGreaterThan(bare.confidence + 0.3);
    expect(bare.merchant).toBeNull();
  });

  it('never reads the balance or limit as the amount', () => {
    const c = parseSms('Rs 486.00 spent on ICICI Bank Card XX4005 at SWIGGY. Avl Limit: Rs 1,85,180.00', { receivedAt: RX })!;
    expect(c.amountPaise).toBe(48600);
    const d = parseSms('Avl Bal Rs 9,999.00. Rs 150 debited from A/c XX1111 to Chai', { receivedAt: RX })!;
    expect(d.amountPaise).toBe(15000);
    expect(d.balancePaise).toBe(999900);
  });

  it('treats a refund as money in', () => {
    const c = parseSms('Refund of Rs.899.00 credited to your A/c XX4021 on 24-10-26 from MYNTRA', { receivedAt: RX })!;
    expect(c.direction).toBe('in');
    expect(c.merchant).toBe('Myntra');
  });
});

describe('helpers', () => {
  it.each([
    ['486', 48600],
    ['486.5', 48650],
    ['1,24,567.50', 12456750],
    ['150.000', 15000],
    ['150.005', null],
    ['', null],
    ['abc', null],
    ['12,34,567', 123456700],
    ['0', 0],
  ])('amountToPaise(%p) = %p', (s, expected) => {
    expect(amountToPaise(s)).toBe(expected);
  });

  it('strips balance and limit amounts', () => {
    const r = stripBalances('Rs 100 spent. Avl Bal: Rs 5,000.50 Avl Limit Rs 90,000');
    expect(r.balancePaise).toBe(500050);
    expect(r.limitPaise).toBe(9000000);
    expect(r.text).toContain('Rs 100');
    expect(r.text).not.toContain('5,000');
  });

  it.each([
    ['on 24/10/26', { y: 2026, mo: 9, d: 24 }],
    ['24-10-2026', { y: 2026, mo: 9, d: 24 }],
    ['24Oct26', { y: 2026, mo: 9, d: 24 }],
    ['24-Oct-2026', { y: 2026, mo: 9, d: 24 }],
    ['24 October 2026', { y: 2026, mo: 9, d: 24 }],
    ['Oct 24, 2026', { y: 2026, mo: 9, d: 24 }],
    ['2026-10-24:15:12:00', { y: 2026, mo: 9, d: 24 }],
    ['31/02/26', null],
    ['no date', null],
  ])('findDate(%p)', (s, expected) => {
    expect(findDate(s)).toEqual(expected);
  });

  it.each([
    ['at 15:12:00', { h: 15, min: 12 }],
    ['3:12 PM', { h: 15, min: 12 }],
    ['12:05 am', { h: 0, min: 5 }],
    ['12:30 pm', { h: 12, min: 30 }],
    ['25:00', null],
    ['nothing', null],
  ])('findTime(%p)', (s, expected) => {
    expect(findTime(s)).toEqual(expected);
  });

  it('messageTime without anything returns the received time', () => {
    expect(messageTime('hello', RX)).toEqual({ at: RX, timeKnown: false });
  });

  it('cleans merchants', () => {
    expect(cleanMerchant('VPA swiggy@icici')).toBe('Swiggy');
    expect(cleanMerchant('NEFT-HDFC000123-ACME CORP')).toBe('Acme Corp');
    expect(cleanMerchant('AMAZON PAY INDIA.')).toBe('Amazon Pay India');
    expect(cleanMerchant('Third Wave Coffee')).toBe('Third Wave Coffee');
    expect(cleanMerchant('   ')).toBeNull();
    expect(merchantFromVpa('9876543210@ybl')).toEqual({ name: '9876543210', looksLikePerson: true });
    expect(merchantFromVpa('paytmqr281005050101abc@paytm').name.length).toBeGreaterThan(0);
  });
});
