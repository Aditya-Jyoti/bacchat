import { parseEmail } from '../email';

const RX = new Date(2026, 9, 24, 21, 30).getTime();
const ctx = { receivedAt: RX };

describe('parseEmail', () => {
  it('reads a bank card alert email like an SMS and marks it as mail', () => {
    const c = parseEmail(
      {
        from: 'ICICI Bank <credit_cards@icicibank.com>',
        subject: 'Transaction alert for your ICICI Bank Credit Card',
        body: 'Dear Customer, Your ICICI Bank Credit Card XX4005 has been used for a transaction of INR 1,249.00 on Oct 24, 2026 at 03:12 PM. Info: AMAZON. The Available Credit Limit on your card is INR 1,85,000.00.',
      },
      ctx,
    )!;
    expect(c.source).toBe('mail');
    expect(c.amountPaise).toBe(124900);
    expect(c.cardLast4).toBe('4005');
    expect(c.at).toBe(new Date(2026, 9, 24, 15, 12).getTime());
    expect(c.confidence).toBeLessThanOrEqual(0.95);
  });

  it.each([
    [
      'Amazon order',
      { from: 'auto-confirm@amazon.in', subject: 'Your Amazon.in order of "Boat Rockerz..."', body: 'Order Placed: 24 October 2026. Order Total: \u20B91,299.00. Arriving Tuesday.' },
      { merchant: 'Amazon', paise: 129900, dir: 'out' },
    ],
    [
      'Swiggy order',
      { from: 'noreply@swiggy.in', subject: 'Your Swiggy order receipt', body: 'Thanks for ordering. Item total \u20B9440. Bill Total: Rs 486.00 paid via UPI.' },
      { merchant: 'Swiggy', paise: 48600, dir: 'out' },
    ],
    [
      'Uber ride',
      { from: 'Uber Receipts <uber.us@uber.com>', subject: 'Your Saturday evening trip with Uber', body: 'Total \u20B9212.50. Thanks for riding.' },
      { merchant: 'Uber', paise: 21250, dir: 'out' },
    ],
    [
      'Netflix payment',
      { from: 'info@mailer.netflix.com', subject: 'Your Netflix payment receipt', body: 'We received your payment of \u20B9199.00 on 28 Oct 2026.' },
      { merchant: 'Netflix', paise: 19900, dir: 'out' },
    ],
    [
      'Refund',
      { from: 'support@myntra.com', subject: 'Your Myntra refund has been processed', body: 'Refund amount: \u20B9899.00 will reach your account in 2 days. Total: \u20B9899.00' },
      { merchant: 'Myntra', paise: 89900, dir: 'in' },
    ],
    [
      'Unknown sender uses display name',
      { from: '"Chai Point" <orders@chaipoint.example>', subject: 'Your receipt', body: 'Amount paid: Rs. 40' },
      { merchant: 'Chai Point', paise: 4000, dir: 'out' },
    ],
  ])('receipt: %s', (_n, mail, e) => {
    const c = parseEmail(mail, ctx)!;
    expect(c).not.toBeNull();
    expect(c.source).toBe('mail');
    expect(c.merchant).toBe(e.merchant);
    expect(c.amountPaise).toBe(e.paise);
    expect(c.direction).toBe(e.dir);
    expect(c.confidence).toBeLessThanOrEqual(0.85);
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it('dates a receipt from its text, else from the received time', () => {
    const a = parseEmail({ from: 'a@amazon.in', subject: 'Your Amazon.in order', body: 'Order Placed: 24 October 2026. Order Total: \u20B9100' }, { receivedAt: new Date(2026, 9, 25, 9, 0).getTime() })!;
    expect(new Date(a.at).getDate()).toBe(24);
    const b = parseEmail({ from: 'a@amazon.in', subject: 'Your Amazon.in order', body: 'Order Total: \u20B9100' }, ctx)!;
    expect(b.at).toBe(RX);
    expect(b.timeKnown).toBe(false);
  });

  it.each([
    ['newsletter', { from: 'news@shop.example', subject: 'Big sale this weekend', body: 'Up to 50% off. Prices from Rs 499.' }],
    ['otp', { from: 'x@bank.example', subject: 'Your OTP', body: 'Use 123456 to verify. Amount Rs 500.' }],
    ['no total', { from: 'a@amazon.in', subject: 'Your order has shipped', body: 'It will arrive soon.' }],
  ])('ignores %s', (_n, mail) => {
    expect(parseEmail(mail, ctx)).toBeNull();
  });
});
