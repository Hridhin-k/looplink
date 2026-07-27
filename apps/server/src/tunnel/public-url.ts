import { TUNNEL_ID_BYTES, TUNNEL_SLUG_LENGTH } from "@hridhin-k/badger-shared";

/**
 * Default public DNS suffix used when building tunnel URLs.
 */
export const DEFAULT_PUBLIC_BASE_DOMAIN = "badger.dev";

/**
 * How public tunnel URLs are minted.
 *
 * - `path` — Railway-compatible `https://{domain}/tunnel/{tunnelId}`
 * - `subdomain` — classic wildcard `https://{slug}.{domain}`
 */
export type PublicUrlMode = "path" | "subdomain";

/**
 * Default URL mode. Path-based works on hosts that only terminate TLS for the
 * apex name (for example Railway's `*.up.railway.app` service domain).
 */
export const DEFAULT_PUBLIC_URL_MODE: PublicUrlMode = "path";

/** URL path prefix for path-based tunnel routing. */
export const TUNNEL_PATH_PREFIX = "/tunnel";

export { TUNNEL_SLUG_LENGTH };

/**
 * Derives the public subdomain slug from a tunnel id.
 *
 * @param tunnelId - Unique tunnel identifier (hex string).
 * @returns A {@link TUNNEL_SLUG_LENGTH}-character hex slug.
 */
export function tunnelSlug(tunnelId: string): string {
  return tunnelId.replaceAll("-", "").slice(0, TUNNEL_SLUG_LENGTH).toLowerCase();
}

/**
 * Options for {@link buildPublicUrl}.
 */
export interface BuildPublicUrlOptions {
  /** Public DNS host / suffix. Defaults to {@link resolvePublicBaseDomain}. */
  readonly baseDomain?: string;
  /** URL shape. Defaults to {@link resolvePublicUrlMode}. */
  readonly mode?: PublicUrlMode;
}

/**
 * Builds the public HTTPS URL for a tunnel id.
 *
 * @param tunnelId - Unique tunnel identifier.
 * @param options - Optional domain and URL mode overrides.
 * @returns A public URL in the configured mode.
 */
export function buildPublicUrl(tunnelId: string, options: BuildPublicUrlOptions = {}): string {
  const baseDomain = options.baseDomain ?? resolvePublicBaseDomain();
  const mode = options.mode ?? resolvePublicUrlMode();

  if (mode === "path") {
    return `https://${baseDomain}${TUNNEL_PATH_PREFIX}/${tunnelId}`;
  }

  return `https://${tunnelSlug(tunnelId)}.${baseDomain}`;
}

/**
 * Result of parsing a path-based tunnel request URL.
 */
export interface ParsedTunnelPath {
  /** Tunnel id extracted from `/tunnel/{id}/...`. */
  readonly tunnelId: string;
  /** Path the local app should see (prefix stripped). */
  readonly localPath: string;
}

/**
 * Parses `/tunnel/{tunnelId}` and `/tunnel/{tunnelId}/...` request paths.
 *
 * @param pathname - URL pathname without query string.
 * @returns Tunnel id and rewritten local path, or `undefined` when not a tunnel path.
 */
export function parseTunnelPath(pathname: string): ParsedTunnelPath | undefined {
  const prefix = `${TUNNEL_PATH_PREFIX}/`;
  if (!pathname.startsWith(prefix)) {
    return undefined;
  }

  const remainder = pathname.slice(prefix.length);
  if (remainder.length === 0) {
    return undefined;
  }

  const slash = remainder.indexOf("/");
  const tunnelId = slash === -1 ? remainder : remainder.slice(0, slash);
  const rest = slash === -1 ? "" : remainder.slice(slash + 1);

  if (!isTunnelId(tunnelId)) {
    return undefined;
  }

  return {
    tunnelId: tunnelId.toLowerCase(),
    localPath: rest.length === 0 ? "/" : `/${rest}`,
  };
}

/**
 * Extracts a tunnel slug from an HTTP `Host` header value.
 *
 * @param hostHeader - Raw `Host` header (may include a port).
 * @param baseDomain - Public DNS suffix.
 * @returns The subdomain slug, or `undefined` when the host is not a tunnel host.
 */
export function extractTunnelSlugFromHost(
  hostHeader: string,
  baseDomain: string = DEFAULT_PUBLIC_BASE_DOMAIN,
): string | undefined {
  const hostname = hostHeader.split(":")[0]?.toLowerCase();
  if (hostname === undefined || hostname.length === 0) {
    return undefined;
  }

  const suffix = `.${baseDomain.toLowerCase()}`;
  if (!hostname.endsWith(suffix)) {
    return undefined;
  }

  const slug = hostname.slice(0, -suffix.length);
  if (slug.length === 0 || slug.includes(".")) {
    return undefined;
  }

  return slug;
}

/**
 * Resolves the public base domain from the environment.
 *
 * @returns A DNS host such as `badger.dev` or a Railway service hostname.
 */
export function resolvePublicBaseDomain(): string {
  const raw = process.env["BADGER_PUBLIC_BASE_DOMAIN"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_PUBLIC_BASE_DOMAIN;
  }

  return raw.trim();
}

/**
 * Resolves how public tunnel URLs are minted.
 *
 * @returns `path` (default) or `subdomain`.
 */
export function resolvePublicUrlMode(): PublicUrlMode {
  const raw = process.env["BADGER_PUBLIC_URL_MODE"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_PUBLIC_URL_MODE;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "path" || normalized === "subdomain") {
    return normalized;
  }

  throw new Error(`Invalid BADGER_PUBLIC_URL_MODE "${raw}": expected "path" or "subdomain".`);
}

/**
 * Narrows a path segment to a Badger tunnel id (hex of {@link TUNNEL_ID_BYTES}).
 *
 * @param value - Candidate path segment.
 * @returns `true` when the value is a plausible tunnel id.
 */
export function isTunnelId(value: string): boolean {
  const expectedLength = TUNNEL_ID_BYTES * 2;
  return value.length === expectedLength && /^[0-9a-f]+$/i.test(value);
}
