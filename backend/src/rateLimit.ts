/** Small fixed-window in-memory rate limiter keyed by string (for example client IP). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns 0 when allowed, otherwise the number of seconds until the window resets. */
  check(key: string): number {
    if (this.limit === 0) return 0; // 0 disables the limiter
    const t = this.now();
    if (this.hits.size > 10_000) this.sweep(t);
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return entry.count > this.limit ? Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) : 0;
  }

  private sweep(t: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
