/** @jest-environment node */
import { createHash, createHmac } from 'node:crypto';
import { hmacSha256, sha256, toHex, utf8 } from '../targets/sha256';
import { signRequest, splitUrl, uriEncode } from '../targets/sigv4';

describe('sha256 and hmac', () => {
  it('match node:crypto for assorted lengths', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100000]) {
      const data = Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 255);
      expect(toHex(sha256(data))).toBe(createHash('sha256').update(data).digest('hex'));
    }
  });
  it('hmac matches node:crypto, including long keys', () => {
    for (const k of ['k', 'x'.repeat(64), 'y'.repeat(200)]) {
      expect(toHex(hmacSha256(utf8(k), utf8('message')))).toBe(createHmac('sha256', k).update('message').digest('hex'));
    }
  });
  it('encodes utf8 including astral characters', () => {
    expect(Array.from(utf8('a\u20B9\u{1F600}'))).toEqual(Array.from(Buffer.from('a\u20B9\u{1F600}')));
  });
});

describe('SigV4', () => {
  it('reproduces the AWS documentation signature (GET Object with Range)', () => {
    const h = signRequest(
      { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' },
      { method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, now: new Date('2013-05-24T00:00:00Z') },
    );
    expect(h.Authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
  it('reproduces the AWS documentation signature (PUT Object with body)', () => {
    const h = signRequest(
      { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' },
      {
        method: 'PUT',
        url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
        headers: { Date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
        body: 'Welcome to Amazon S3.',
        now: new Date('2013-05-24T00:00:00Z'),
      },
    );
    expect(h.Authorization).toContain('Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  });
  it('encodes and splits like S3 expects', () => {
    expect(uriEncode('a b/c', true)).toBe('a%20b/c');
    expect(uriEncode('a/b')).toBe('a%2Fb');
    expect(splitUrl('http://h:9000/b/k%20x?prefix=a%2Fb&list-type=2')).toEqual({
      host: 'h:9000',
      pathname: '/b/k%20x',
      query: [
        ['prefix', 'a/b'],
        ['list-type', '2'],
      ],
    });
  });
});
