/**
 * Decides whether an inbound `Origin` (or fallback `Host`) is allowed.
 *
 * Empty allow-list means "allow all" — appropriate for local development.
 * In production set `LOOPLINK_ALLOWED_ORIGINS` to a comma-separated list of
 * exact origins (e.g. `https://looplink.dev`) or hostnames.
 */
export class OriginValidator {
  private readonly allowed: ReadonlySet<string>;

  /**
   * @param allowedOrigins - Exact origin or hostname strings. Empty → allow all.
   */
  constructor(allowedOrigins: readonly string[] = []) {
    this.allowed = new Set(
      allowedOrigins.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
    );
  }

  /**
   * @returns `true` when no allow-list is configured (permissive mode).
   */
  isPermissive(): boolean {
    return this.allowed.size === 0;
  }

  /**
   * Validates an HTTP `Origin` header value.
   *
   * When `Origin` is absent (non-browser clients such as the LoopLink CLI),
   * the request is allowed — CLI traffic does not send Origin. Browser
   * requests that send a disallowed Origin are rejected.
   *
   * @param originHeader - Raw `Origin` header, or `undefined` when omitted.
   * @returns `true` when the request may proceed.
   */
  isOriginAllowed(originHeader: string | undefined): boolean {
    if (this.isPermissive()) {
      return true;
    }

    if (originHeader === undefined || originHeader.trim().length === 0) {
      // Non-browser clients (CLI `ws`) typically omit Origin.
      return true;
    }

    return this.matches(originHeader);
  }

  /**
   * Validates a `Host` header for public HTTP tunnel traffic.
   *
   * @param hostHeader - Raw `Host` header (may include a port).
   * @param baseDomain - Configured public base domain (e.g. `looplink.dev`).
   * @returns `true` when the host is the apex, a tunnel subdomain, or allow-listed.
   */
  isHostAllowed(hostHeader: string | undefined, baseDomain: string): boolean {
    if (hostHeader === undefined || hostHeader.trim().length === 0) {
      return false;
    }

    const hostname = hostHeader.split(":")[0]?.toLowerCase();
    if (hostname === undefined || hostname.length === 0) {
      return false;
    }

    const domain = baseDomain.toLowerCase();
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }

    if (this.isPermissive()) {
      return true;
    }

    return this.allowed.has(hostname) || this.matches(`https://${hostname}`);
  }

  private matches(candidate: string): boolean {
    const normalized = candidate.trim().toLowerCase();

    if (this.allowed.has(normalized)) {
      return true;
    }

    try {
      const url = new URL(normalized.includes("://") ? normalized : `https://${normalized}`);
      return (
        this.allowed.has(url.origin) || this.allowed.has(url.host) || this.allowed.has(url.hostname)
      );
    } catch {
      return false;
    }
  }
}

/**
 * Parses a comma-separated allow-list from the environment.
 *
 * @param raw - Raw env value.
 * @returns Trimmed origin/hostname entries.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
