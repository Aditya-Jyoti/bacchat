import { __setNativeOcrForTests, isOcrAvailable, recognize } from '..';
import { createMockNativeOcr } from '../mock';

afterEach(() => __setNativeOcrForTests(undefined));

describe('bacchat-ocr wrapper', () => {
  it('is unavailable without the native module and rejects', async () => {
    expect(isOcrAvailable()).toBe(false);
    await expect(recognize('file:///a.png')).rejects.toThrow('not available');
  });

  it('passes the uri to the native module and returns its result', async () => {
    const mock = createMockNativeOcr([{ text: 'Swiggy', top: 10, left: 4 }]);
    __setNativeOcrForTests(mock);
    expect(isOcrAvailable()).toBe(true);
    const r = await recognize('file:///a.png');
    expect(mock.calls).toEqual(['file:///a.png']);
    expect(r.text).toBe('Swiggy');
    expect(r.lines).toHaveLength(1);
  });
});
