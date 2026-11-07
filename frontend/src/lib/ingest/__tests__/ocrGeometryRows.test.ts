/** Row joining on a real payments-app layout (1272 x 2800 screenshot, positions from the owner's screen). */
import { isChrome, joinLinesByRow, type PositionedLine } from '../ocrGeometry';
import { parseOcrLines } from '../ocr';

const W = 1272;
const H = 2800;
const box = (text: string, left: number, top: number, right: number, bottom: number): PositionedLine => ({ text, left, top, right, bottom });

// One row: avatar or logo (x 80-220), name (x 268), amount right-aligned (ends x 1186), date below the name.
function row(y: number, avatar: string | null, name: string, amount: string): PositionedLine[] {
  const out = [box(name, 268, y, 268 + name.length * 26, y + 50), box(amount, 1186 - amount.length * 26, y, 1186, y + 50), box("6 Nov '26", 268, y + 66, 470, y + 104)];
  // The avatar letter sits in a circle centred between the name and the date lines.
  if (avatar) out.push(box(avatar, 134, y + 26, 166, y + 80));
  return out;
}

const SCREEN: PositionedLine[] = [
  box('22:43', 104, 56, 230, 104),
  box('46.0 KB/S', 1180 - 300, 50, 1000, 104),
  box('23%', 1110, 56, 1188, 104),
  box('Activity', 86, 196, 420, 270),
  box('Search transactions', 296, 470, 760, 516),
  ...row(690, 'blinkit', 'Blinkit', '₹1,120'),
  ...row(952, null, 'Nov Round ups', '₹67.2'),
  ...row(1214, 'K', 'Kuldeep Sahu', '₹253'),
  ...row(1476, 'V', 'Vivek Kumar', '₹100'),
  ...row(1738, 'district', 'District', '₹1,421.8'),
  ...row(2000, 'R', 'Rohit', '₹151'),
  ...row(2262, null, 'Nov savings interest', '₹6.18'),
].sort(() => 0.5 - Math.random());

describe('joinLinesByRow with boxes', () => {
  it('drops the status bar and avatar or logo text', () => {
    expect(isChrome(box('22:43', 104, 56, 230, 104), W, H)).toBe(true);
    expect(isChrome(box('K', 134, 1240, 166, 1294), W, H)).toBe(true);
    expect(isChrome(box('blinkit', 90, 720, 220, 760), W, H)).toBe(true);
    expect(isChrome(box('Blinkit', 268, 690, 450, 740), W, H)).toBe(false);
    // A date in a left column has digits, so it is kept.
    expect(isChrome(box('06 Nov', 40, 900, 200, 940), W, H)).toBe(false);
  });

  it('joins each name with its own amount, in order, whatever order the lines arrive in', () => {
    const rows = joinLinesByRow(SCREEN, { width: W, height: H });
    expect(rows.filter((r) => r.includes('₹'))).toEqual([
      'Blinkit  ₹1,120',
      'Nov Round ups  ₹67.2',
      'Kuldeep Sahu  ₹253',
      'Vivek Kumar  ₹100',
      'District  ₹1,421.8',
      'Rohit  ₹151',
      'Nov savings interest  ₹6.18',
    ]);
    expect(rows.some((r) => /KB\/S|23%|22:43/.test(r))).toBe(false);
  });

  it('end to end, the parser gets the five real payments', () => {
    const rows = parseOcrLines(joinLinesByRow(SCREEN, { width: W, height: H }), { referenceDay: new Date(2026, 10, 6, 23).getTime() });
    expect(rows.map((r) => [r.merchant, r.amountPaise])).toEqual([
      ['Blinkit', 112000],
      ['Kuldeep Sahu', 25300],
      ['Vivek Kumar', 10000],
      ['District', 142180],
      ['Rohit', 15100],
    ]);
  });

  it('without boxes, keeps the old top tolerance', () => {
    expect(joinLinesByRow([{ text: 'Swiggy', top: 100, left: 10 }, { text: 'Rs 486', top: 108, left: 300 }])).toEqual(['Swiggy  Rs 486']);
  });
});
