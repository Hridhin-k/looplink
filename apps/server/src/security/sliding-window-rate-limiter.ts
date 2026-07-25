/**
 * Result of attempting to consume a rate-limit token.
 */
export interface RateLimitDecision {
  /** `true` when the action is allowed under the current window. */
  readonly allowed: boolean;
  /** Remaining tokens in the current window after this decision. */
  readonly remaining: number;
  /** Milliseconds until the oldest event exits the window (0 when allowed). */
  readonly retryAfterMs: number;
}

/**
 * Fixed-window / sliding-window rate limiter keyed by an opaque string.
 *
 * Reusable for WebSocket message rates and any in-process limit that does not
 * need a distributed store. Timestamps are kept in a ring per key and pruned
 * on each check so idle keys eventually free memory when removed explicitly.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /**
   * @param limit - Maximum events allowed inside one window.
   * @param windowMs - Window length in milliseconds.
   * @param now - Clock injection for tests. Defaults to `Date.now`.
   */
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Attempts to record an event for `key`.
   *
   * @param key - Partition key (IP, connection id, etc.).
   * @returns Whether the event is allowed and how long to wait if not.
   */
  attempt(key: string): RateLimitDecision {
    const now = this.now();
    const cutoff = now - this.windowMs;
    const existing = this.hits.get(key) ?? [];
    const recent = existing.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + this.windowMs - now),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);

    return {
      allowed: true,
      remaining: this.limit - recent.length,
      retryAfterMs: 0,
    };
  }

  /**
   * Drops tracking state for a key (e.g. on disconnect).
   *
   * @param key - Partition key to forget.
   */
  reset(key: string): void {
    this.hits.delete(key);
  }

  /**
   * Clears every key. Intended for tests.
   */
  clear(): void {
    this.hits.clear();
  }
}
