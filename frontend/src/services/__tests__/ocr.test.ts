import { joinLinesByRow, parseOcrLines } from '../../lib/ingest';
import { getOcrEngine, sampleOcrLines, setOcrEngine } from '../../screens/money/importFlow';
import { installNativeOcr, linesFromResult } from '../ocr';

afterEach(() => setOcrEngine(null));

const NOW = new Date(2024, 9, 24, 15, 0).getTime();

describe('joinLinesByRow', () => {
  it('joins lines on the same row left to right and orders rows top to bottom', () => {
    const rows = joinLinesByRow([
      { text: '\u20B9486', top: 102, left: 700 },
      { text: 'Zomato', top: 220, left: 40 },
      { text: 'Swiggy', top: 100, left: 40 },
      { text: '\u20B9250', top: 224, left: 700 },
      { text: '  ', top: 300, left: 0 },
    ]);
    expect(rows).toEqual(['Swiggy  \u20B9486', 'Zomato  \u20B9250']);
  });

  it('keeps stacked lines apart', () => {
    expect(joinLinesByRow([{ text: 'Swiggy', top: 10, left: 0 }, { text: '\u20B9486', top: 80, left: 0 }])).toEqual(['Swiggy', '\u20B9486']);
  });

  it('lets parseOcrLines read split rows', () => {
    const rows = parseOcrLines(
      joinLinesByRow([
        { text: 'Swiggy', top: 100, left: 40 },
        { text: '\u20B9486', top: 104, left: 700 },
        { text: '1:42 pm', top: 98, left: 400 },
      ]),
      { referenceDay: NOW },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].merchant).toBe('Swiggy');
    expect(rows[0].amountPaise).toBe(48600);
  });
});

describe('installNativeOcr', () => {
  it('keeps the stub when the native module is missing', () => {
    const before = getOcrEngine();
    expect(installNativeOcr()).toBe(false);
    expect(getOcrEngine()).toBe(before);
  });

  it('installs an engine that reads the image and joins rows', async () => {
    const recognize = jest.fn(async () => ({
      text: 'Swiggy\n\u20B9486',
      lines: [
        { text: 'Swiggy', top: 100, left: 40 },
        { text: '\u20B9486', top: 101, left: 700 },
      ],
    }));
    expect(installNativeOcr({ available: () => true, recognize })).toBe(true);
    expect(await getOcrEngine()('file:///shot.png')).toEqual(['Swiggy  \u20B9486']);
    expect(recognize).toHaveBeenCalledWith('file:///shot.png');
  });

  it('uses the sample lines when no image is given', async () => {
    installNativeOcr({ available: () => true, recognize: jest.fn() });
    expect(await getOcrEngine()(null)).toEqual(sampleOcrLines());
  });

  it('falls back to the raw text when there are no positions', () => {
    expect(linesFromResult({ text: 'a\n\n b ', lines: [] })).toEqual(['a', 'b']);
  });
});
