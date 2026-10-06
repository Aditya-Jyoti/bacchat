/** Tiny in-process HTTP servers (WebDAV and S3 subsets) for exercising conditional writes for real. */
import { createHash } from 'node:crypto';
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { HttpFetch } from '../target';
import { signRequest } from '../targets/sigv4';

/** Real node:http fetch with response headers (Jest's RN preset replaces global fetch). */
export const nodeHttpFetch: HttpFetch = (url, init) =>
  new Promise((resolveFetch, reject) => {
    const req = request(url, { method: init?.method ?? 'GET', headers: init?.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        resolveFetch({
          status,
          ok: status >= 200 && status < 300,
          headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
          text: async () => Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (init?.body !== undefined) req.write(init.body);
    req.end();
  });

type Obj = { body: string; etag: string; mtime: Date };

export interface FakeServer {
  url: string;
  objects: Map<string, Obj>;
  requests: { method: string; path: string; headers: IncomingMessage['headers'] }[];
  stop(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res) => {
    const c: Buffer[] = [];
    req.on('data', (d: Buffer) => c.push(d));
    req.on('end', () => res(Buffer.concat(c).toString('utf8')));
  });
}

const md5q = (s: string): string => `"${createHash('md5').update(s).digest('hex')}"`;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Shared conditional-write rule (RFC 7232): returns true when the write may go ahead. */
function preconditionOk(h: IncomingMessage['headers'], cur: Obj | undefined): boolean {
  const ifMatch = h['if-match'];
  const ifNone = h['if-none-match'];
  if (ifMatch !== undefined && (!cur || (ifMatch !== '*' && ifMatch !== cur.etag))) return false;
  if (ifNone !== undefined && cur && (ifNone === '*' || ifNone === cur.etag)) return false;
  return true;
}

function listen(server: Server): Promise<string> {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });
}

export async function startWebDavServer(opts: { user: string; pass: string; omitPutEtag?: boolean }): Promise<FakeServer & { folders: Set<string> }> {
  const objects = new Map<string, Obj>();
  const folders = new Set<string>(['/dav']);
  const requests: FakeServer['requests'] = [];
  const expected = `Basic ${Buffer.from(`${opts.user}:${opts.pass}`).toString('base64')}`;
  const server = createServer(async (req, res: ServerResponse) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/+$/, '');
    requests.push({ method: req.method ?? '', path, headers: req.headers });
    const body = await readBody(req);
    if (req.headers.authorization !== expected) {
      res.writeHead(401).end();
      return;
    }
    const send = (status: number, headers: Record<string, string> = {}, text = ''): void => {
      res.writeHead(status, headers).end(text);
    };
    switch (req.method) {
      case 'MKCOL': {
        if (folders.has(path) || objects.has(path)) return send(405);
        const parent = path.slice(0, path.lastIndexOf('/'));
        if (parent && !folders.has(parent)) return send(409);
        folders.add(path);
        return send(201);
      }
      case 'PROPFIND': {
        if (!folders.has(path)) return send(404);
        const depth = req.headers.depth;
        let xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${esc(path)}/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>`;
        if (depth === '1') {
          for (const [p, o] of objects) {
            if (p.slice(0, p.lastIndexOf('/')) !== path) continue;
            xml += `<d:response><d:href>${esc(encodeURI(p))}</d:href><d:propstat><d:prop><d:getetag>${esc(o.etag)}</d:getetag><d:getcontentlength>${Buffer.byteLength(o.body)}</d:getcontentlength><d:getlastmodified>${o.mtime.toUTCString()}</d:getlastmodified><d:resourcetype/></d:prop></d:propstat></d:response>`;
          }
        }
        return send(207, { 'Content-Type': 'application/xml' }, `${xml}</d:multistatus>`);
      }
      case 'GET':
      case 'HEAD': {
        const o = objects.get(path);
        if (!o) return send(404);
        return send(200, { ETag: o.etag }, req.method === 'GET' ? o.body : '');
      }
      case 'PUT': {
        const cur = objects.get(path);
        const parent = path.slice(0, path.lastIndexOf('/'));
        if (!folders.has(parent)) return send(409);
        if (!preconditionOk(req.headers, cur)) return send(412);
        const etag = md5q(body + objects.size + Math.random());
        objects.set(path, { body, etag, mtime: new Date() });
        return send(cur ? 204 : 201, opts.omitPutEtag ? {} : { ETag: etag });
      }
      case 'DELETE':
        return send(objects.delete(path) ? 204 : 404);
      default:
        return send(405);
    }
  });
  const url = await listen(server);
  return { url: `${url}/dav`, objects, folders, requests, stop: () => new Promise((r) => server.close(() => r())) };
}

export interface FakeS3 extends FakeServer {
  creds: { accessKeyId: string; secretAccessKey: string; region: string };
  bucket: string;
}

/** S3 subset: HEAD bucket, ListObjectsV2, object GET/PUT/DELETE with conditional PUT, and SigV4 verification. */
export async function startS3Server(opts: { bucket: string; maxKeysPerPage?: number }): Promise<FakeS3> {
  const creds = { accessKeyId: 'minioadmin', secretAccessKey: 'minio-secret-key', region: 'us-east-1' };
  const objects = new Map<string, Obj>();
  const requests: FakeServer['requests'] = [];
  const server = createServer(async (req, res) => {
    const rawUrl = req.url ?? '/';
    const [rawPath, query = ''] = rawUrl.split('?');
    requests.push({ method: req.method ?? '', path: rawPath, headers: req.headers });
    const body = await readBody(req);
    const send = (status: number, headers: Record<string, string> = {}, text = ''): void => {
      res.writeHead(status, headers).end(text);
    };
    // Verify the signature by re-signing exactly what arrived.
    const got = String(req.headers.authorization ?? '');
    const date = String(req.headers['x-amz-date'] ?? '');
    const forward: Record<string, string> = {};
    for (const h of ['content-type', 'if-match', 'if-none-match']) if (req.headers[h]) forward[h] = String(req.headers[h]);
    const want = signRequest(creds, {
      method: req.method ?? 'GET',
      url: `http://${req.headers.host}${rawUrl}`,
      headers: forward,
      body,
      now: new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`),
    }).Authorization;
    if (got !== want) {
      return send(403, {}, '<Error><Code>SignatureDoesNotMatch</Code></Error>');
    }
    const path = decodeURIComponent(rawPath);
    const prefixPath = `/${opts.bucket}`;
    if (path === prefixPath || path === `${prefixPath}/`) {
      if (req.method === 'HEAD') return send(200);
      const params = new URLSearchParams(query);
      const prefix = params.get('prefix') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const max = opts.maxKeysPerPage ?? 1000;
      const start = params.get('continuation-token') ? Number(params.get('continuation-token')) : 0;
      const page = keys.slice(start, start + max);
      const more = start + max < keys.length;
      const items = page
        .map((k) => {
          const o = objects.get(k)!;
          return `<Contents><Key>${esc(k)}</Key><LastModified>${o.mtime.toISOString()}</LastModified><ETag>${esc(o.etag)}</ETag><Size>${Buffer.byteLength(o.body)}</Size></Contents>`;
        })
        .join('');
      return send(200, { 'Content-Type': 'application/xml' }, `<?xml version="1.0"?><ListBucketResult><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${start + max}</NextContinuationToken>` : ''}${items}</ListBucketResult>`);
    }
    if (!path.startsWith(`${prefixPath}/`)) return send(404);
    const key = path.slice(prefixPath.length + 1);
    const cur = objects.get(key);
    switch (req.method) {
      case 'GET':
      case 'HEAD':
        return cur ? send(200, { ETag: cur.etag }, req.method === 'GET' ? cur.body : '') : send(404, {}, '<Error><Code>NoSuchKey</Code></Error>');
      case 'PUT': {
        if (!preconditionOk(req.headers, cur)) {
          if (req.headers['if-match'] && !cur) return send(404, {}, '<Error><Code>NoSuchKey</Code></Error>');
          return send(412, {}, '<Error><Code>PreconditionFailed</Code></Error>');
        }
        const etag = md5q(body);
        objects.set(key, { body, etag, mtime: new Date() });
        return send(200, { ETag: etag });
      }
      case 'DELETE':
        objects.delete(key);
        return send(204);
      default:
        return send(405);
    }
  });
  const url = await listen(server);
  return { url, objects, requests, creds, bucket: opts.bucket, stop: () => new Promise((r) => server.close(() => r())) };
}
