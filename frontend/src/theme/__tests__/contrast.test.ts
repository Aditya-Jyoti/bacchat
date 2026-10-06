import { contrastRatio, passesTextContrast } from '../contrast';

describe('contrast', () => {
  it('computes known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
  it('is symmetric and thresholded at 4.5', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(contrastRatio('#FEDCBA', '#123456'), 10);
    expect(passesTextContrast('#767676', '#FFFFFF')).toBe(true);
    expect(passesTextContrast('#888888', '#FFFFFF')).toBe(false);
  });
});
