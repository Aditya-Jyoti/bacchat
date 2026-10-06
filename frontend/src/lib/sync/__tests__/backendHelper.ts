/** Starts the real backend (backend/src/server.ts) as a child process for integration tests. */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FetchLike } from '../client';

/** Real Node fetch over node:http (Jest's React Native preset replaces global fetch with an XHR shim). */
export const nodeFetch: FetchLike = (url, init) =>
  new Promise((resolveFetch, reject) => {
    const req = request(url, { method: init?.method ?? 'GET', headers: init?.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        resolveFetch({ status, ok: status >= 200 && status < 300, text: async () => Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    if (init?.body !== undefined) req.write(init.body);
    req.end();
  });

export interface RunningBackend {
  baseUrl: string;
  stop(): Promise<void>;
}

const BACKEND_DIR = resolve(__dirname, '../../../../../backend');

export function backendAvailable(): { ok: boolean; reason: string } {
  const tsx = join(BACKEND_DIR, 'node_modules/.bin/tsx');
  if (!existsSync(tsx)) {
    return { ok: false, reason: `backend dependencies are not installed (missing ${tsx}); run npm install in backend/` };
  }
  return { ok: true, reason: '' };
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
    s.on('error', rej);
  });
}

export async function startBackend(env: Record<string, string> = {}): Promise<RunningBackend> {
  const dataDir = mkdtempSync(join(tmpdir(), 'bacchat-sync-'));
  const port = await freePort();
  const child: ChildProcess = spawn(join(BACKEND_DIR, 'node_modules/.bin/tsx'), ['src/server.ts'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      LOG_LEVEL: 'silent',
      RATE_LIMIT_PER_MIN: '100000',
      REGISTER_LIMIT_PER_HOUR: '1000',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr?.on('data', (d) => (stderr += String(d)));
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`backend exited early: ${stderr}`);
    try {
      const r = await nodeFetch(`${baseUrl}/healthz`);
      if (r.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill('SIGKILL');
      throw new Error(`backend did not start in time: ${stderr}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    baseUrl,
    async stop() {
      if (child.exitCode === null) {
        await new Promise<void>((done) => {
          child.once('exit', () => done());
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 3000).unref();
        });
      }
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
