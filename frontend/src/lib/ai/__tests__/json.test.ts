import { extractJson, validateSchema } from '../provider/json';
import { Sha256 } from '../provider/sha256';

describe('extractJson', () => {
  it('parses plain, fenced and chatty JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go: {"a":{"b":"}"}} hope that helps')).toEqual({ a: { b: '}' } });
    expect(extractJson('[1,2]')).toEqual([1, 2]);
  });
  it('returns undefined for no JSON or unbalanced JSON', () => {
    expect(extractJson('no json here')).toBeUndefined();
    expect(extractJson('{"a": ')).toBeUndefined();
    expect(extractJson('')).toBeUndefined();
  });
});

describe('validateSchema', () => {
  const schema = {
    type: 'object',
    properties: {
      n: { type: 'integer', minimum: 1, maximum: 5 },
      s: { type: ['string', 'null'], maxLength: 3, enum: ['abc', 'de', null] },
      list: { type: 'array', items: { type: 'number' }, maxItems: 2 },
    },
    required: ['n'],
    additionalProperties: false,
  };
  it('accepts valid values', () => {
    expect(validateSchema(schema, { n: 2, s: null, list: [1.5] })).toBeNull();
  });
  it('names the problem', () => {
    expect(validateSchema(schema, {})).toContain('$.n is missing');
    expect(validateSchema(schema, { n: 2.5 })).toContain('integer');
    expect(validateSchema(schema, { n: 9 })).toContain('above');
    expect(validateSchema(schema, { n: 0 })).toContain('below');
    expect(validateSchema(schema, { n: 2, s: 'x' })).toContain('one of');
    expect(validateSchema(schema, { n: 2, list: [1, 2, 3] })).toContain('too many');
    expect(validateSchema(schema, { n: 2, list: ['a'] })).toContain('$.list[0]');
    expect(validateSchema(schema, { n: 2, extra: 1 })).toContain('not allowed');
    expect(validateSchema(schema, [])).toContain('object');
  });
});

describe('Sha256', () => {
  const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
  it('matches known vectors', () => {
    expect(new Sha256().update(enc('')).hex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(new Sha256().update(enc('abc')).hex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(new Sha256().update(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).hex()).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('is the same when fed in odd chunks, across the 64 byte boundary', () => {
    const data = enc('x'.repeat(1000));
    const whole = new Sha256().update(data).hex();
    const s = new Sha256();
    for (let i = 0; i < data.length; i += 37) s.update(data.subarray(i, i + 37));
    expect(s.hex()).toBe(whole);
    expect(new Sha256().update(enc('a'.repeat(1000000))).hex()).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
});
