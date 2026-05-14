import { Request, Response, NextFunction } from 'express';

// ANSI colour helpers (no extra dep). Disable when not a TTY.
const useColor = process.stdout.isTTY;
const c = (code: string, s: string | number) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`;
const dim = (s: string | number) => c('2', s);
const green = (s: string | number) => c('32', s);
const yellow = (s: string | number) => c('33', s);
const red = (s: string | number) => c('31', s);
const cyan = (s: string | number) => c('36', s);

function colourStatus(status: number): string {
  if (status >= 500) return red(status);
  if (status >= 400) return yellow(status);
  if (status >= 300) return cyan(status);
  return green(status);
}

function colourMethod(method: string): string {
  switch (method) {
    case 'GET':
      return cyan(method.padEnd(6));
    case 'POST':
      return green(method.padEnd(6));
    case 'PUT':
    case 'PATCH':
      return yellow(method.padEnd(6));
    case 'DELETE':
      return red(method.padEnd(6));
    default:
      return method.padEnd(6);
  }
}

function clientIp(req: Request): string {
  // With trust proxy=1, req.ip is the forwarded client IP from Traefik.
  return req.ip ?? req.socket.remoteAddress ?? '?';
}

/**
 * Logs every request once it finishes:
 *   2026-05-14T18:32:11.482Z  POST   /v1/auth/login   200  124ms  10.0.0.7
 *
 * Captures errors written via res.json({error: ...}) so we can see why a
 * request failed without grepping the source.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Hook res.json so we can read the {error: ...} body that 4xx/5xx returns.
  let capturedErrorBody: string | undefined;
  const origJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && 'error' in (body as object)) {
      const errVal = (body as { error: unknown }).error;
      capturedErrorBody = typeof errVal === 'string' ? errVal : JSON.stringify(errVal);
    }
    return origJson(body);
  };

  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const ts = dim(new Date().toISOString());
    const method = colourMethod(req.method);
    const status = colourStatus(res.statusCode);
    const dur = dim(`${durMs.toFixed(1)}ms`.padStart(8));
    const ip = dim(clientIp(req));
    const err = capturedErrorBody ? `  ${red('→ ' + capturedErrorBody)}` : '';
    // eslint-disable-next-line no-console
    console.log(`${ts}  ${method} ${req.originalUrl}  ${status}  ${dur}  ${ip}${err}`);
  });

  next();
}
