import { firstNameOf, initialOf, resolveProfile } from '../profile';

const sample = { sample: true, fullName: 'Rahul Sharma', firstName: 'Rahul', initial: 'R' };

describe('profile', () => {
  it('prefers the saved name, in or out of sample mode', () => {
    expect(resolveProfile('  asha mehta ', sample)).toEqual({ firstName: 'asha', fullName: 'asha mehta', initial: 'A', custom: true });
    expect(resolveProfile('Asha', { ...sample, sample: false }).custom).toBe(true);
  });
  it('shows the sample person only in sample mode', () => {
    expect(resolveProfile('', sample)).toEqual({ firstName: 'Rahul', fullName: 'Rahul Sharma', initial: 'R', custom: false });
    expect(resolveProfile('', { ...sample, sample: false })).toEqual({ firstName: '', fullName: '', initial: '', custom: false });
  });
  it('handles Devanagari and empty input', () => {
    expect(initialOf('\u0906\u0936\u093E \u092E\u0947\u0939\u0924\u093E')).toBe('\u0906');
    expect(firstNameOf('')).toBe('');
    expect(initialOf('  ')).toBe('');
  });
});
