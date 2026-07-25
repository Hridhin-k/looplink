/**
 * Outcome of trying to accept a new connection under a limit policy.
 */
export type ConnectionAdmitResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: "global_limit" | "ip_limit" };

/**
 * Tracks live connections against global and per-IP ceilings.
 *
 * Call {@link release} exactly once per successful {@link tryAdmit} when the
 * socket closes, including rejects that acquired a slot then failed later.
 */
export class ConnectionLimiter {
  private readonly countsByIp = new Map<string, number>();
  private total = 0;

  /**
   * @param maxGlobal - Hard ceiling across all clients.
   * @param maxPerIp - Ceiling for a single remote address.
   */
  constructor(
    private readonly maxGlobal: number,
    private readonly maxPerIp: number,
  ) {}

  /**
   * Attempts to reserve a slot for `ip`.
   *
   * @param ip - Client IP (or `"unknown"` when unavailable).
   * @returns Admission result; on failure no slot was reserved.
   */
  tryAdmit(ip: string): ConnectionAdmitResult {
    if (this.total >= this.maxGlobal) {
      return { ok: false, reason: "global_limit" };
    }

    const current = this.countsByIp.get(ip) ?? 0;
    if (current >= this.maxPerIp) {
      return { ok: false, reason: "ip_limit" };
    }

    this.countsByIp.set(ip, current + 1);
    this.total += 1;
    return { ok: true };
  }

  /**
   * Releases a previously admitted slot.
   *
   * @param ip - Client IP that was admitted.
   */
  release(ip: string): void {
    const current = this.countsByIp.get(ip);
    if (current === undefined || current <= 0) {
      return;
    }

    if (current === 1) {
      this.countsByIp.delete(ip);
    } else {
      this.countsByIp.set(ip, current - 1);
    }

    this.total = Math.max(0, this.total - 1);
  }

  /**
   * @returns Current number of admitted connections.
   */
  get size(): number {
    return this.total;
  }

  /**
   * @param ip - Client IP.
   * @returns Live connection count for that IP.
   */
  countFor(ip: string): number {
    return this.countsByIp.get(ip) ?? 0;
  }
}
