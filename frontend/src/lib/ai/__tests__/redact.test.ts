import { findSensitive, isSafeForCloud, redactMessage } from '../redact';

const r = (s: string, o = {}) => redactMessage(s, o);

describe('redactMessage', () => {
  it('masks OTPs and codes, before or after the keyword', () => {
    expect(r('Your OTP is 482913. Do not share.').text).toBe('Your OTP is [OTP]. Do not share.');
    expect(r('482913 is your OTP for login').text).toContain('[OTP] is your OTP');
    expect(r('Use verification code: 7731 to pay').text).toContain('[OTP]');
    expect(r('CVV 123 never share').text).toContain('[OTP]');
    expect(r('OTP 482913').counts.otp).toBe(1);
  });

  it('keeps the amount, date, merchant and last four of the account', () => {
    const msg = 'Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210 Not You? Call 18002586161';
    const out = r(msg).text;
    expect(out).toContain('Rs.486.00');
    expect(out).toContain('*4021');
    expect(out).toContain('SWIGGY');
    expect(out).toContain('24/10/26');
  });

  it('masks long card numbers but keeps the last four', () => {
    expect(r('Card 4111 1111 1111 1234 used').text).toBe('Card XXXXXXXXXXXX1234 used');
    expect(r('Card 4111111111111234 used').text).toBe('Card XXXXXXXXXXXX1234 used');
    expect(r('Card 4111-1111-1111-1234 used').counts.card).toBe(1);
  });

  it('masks full account numbers but not short masked ones or amounts', () => {
    expect(r('A/c 123456789012 debited').text).toBe('A/c XXXXXXXX9012 debited');
    expect(r('A/c XX4021 debited Rs 1,26,000.00').text).toBe('A/c XX4021 debited Rs 1,26,000.00');
    expect(r('Rs.2315.00 debited on 23-10-26').text).toBe('Rs.2315.00 debited on 23-10-26');
    expect(r('Rs 12345678.50 credited').text).toContain('12345678.50');
  });

  it('masks phone numbers in several shapes, and phone-number UPI handles', () => {
    expect(r('Call 9876543210 now').text).toBe('Call [PHONE] now');
    expect(r('Call +91 98765 43210 now').text).toBe('Call [PHONE] now');
    expect(r('Call +919876543210').text).toBe('Call [PHONE]');
    expect(r('paid to 9876543210@ybl on 24-10-26').text).toBe('paid to [PHONE]@ybl on 24-10-26');
    expect(r('toll free 18002586161').text).toBe('toll free XXXXXXX6161');
  });

  it('keeps ordinary UPI handles, because they name the payee', () => {
    expect(r('to VPA bigbasket@hdfcbank(UPI Ref No 429812345670)').text).toBe('to VPA bigbasket@hdfcbank(UPI Ref No XXXXXXXX5670)');
  });

  it('masks balances and limits by default, and can keep balances', () => {
    expect(r('credit of Rs 1,26,000.00. Avl Bal Rs 3,62,400.50 -SBI').text).toBe('credit of Rs 1,26,000.00. Avl Bal [BALANCE] -SBI');
    expect(r('spent. Avl Limit: Rs 1,85,180.00. If not you').text).toContain('Avl Limit [BALANCE]');
    expect(r('Bal: INR 500.00').text).toBe('Bal [BALANCE]');
    expect(r('Avl Bal Rs 3,62,400.50', { keepBalance: true }).text).toBe('Avl Bal Rs 3,62,400.50');
  });

  it('masks email local parts and PAN, keeps the domain', () => {
    expect(r('from rahul.sharma@gmail.com about ABCDE1234F').text).toBe('from [email]@gmail.com about [PAN]');
    expect(r('Aadhaar 1234 5678 9012').text).toBe('Aadhaar XXXXXXXX9012');
  });

  it('does not mistake dates and times for account numbers', () => {
    expect(r('on 24-10-2026 at 14:30 and 24 10 2026').text).toBe('on 24-10-2026 at 14:30 and 24 10 2026');
  });

  it('leaves nothing sensitive behind (idempotent and verified)', () => {
    const msg = 'OTP 123456. Card 4111 1111 1111 1111 A/c 123456789012 call 9876543210 mail a@b.com Avl Bal Rs 9,999.00 PAN ABCDE1234F';
    const once = r(msg).text;
    expect(findSensitive(once)).toEqual([]);
    expect(isSafeForCloud(once)).toBe(true);
    expect(r(once).text).toBe(once);
    expect(isSafeForCloud(msg)).toBe(false);
  });
});
