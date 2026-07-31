import {
  resolveEnvPreferringBadger,
  TUNNEL_ID_BYTES,
  TUNNEL_SLUG_LENGTH,
} from "@hridhin-k/badger-shared";

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
  /**
   * Full public origin for path mode (e.g. `http://localhost:8080`).
   * When set, overrides scheme/host/port from {@link baseDomain}.
   */
  readonly baseUrl?: string;
}

/**
 * Builds the public URL for a tunnel id.
 *
 * Path mode uses HTTPS for normal domains. Local loopback hosts (`localhost`,
 * `127.0.0.1`, with optional port) use HTTP so local servers on `:8080` work.
 * Prefer `BADGER_PUBLIC_BASE_URL` when you need an explicit origin.
 *
 * @param tunnelId - Unique tunnel identifier.
 * @param options - Optional domain and URL mode overrides.
 * @returns A public URL in the configured mode.
 */
export function buildPublicUrl(tunnelId: string, options: BuildPublicUrlOptions = {}): string {
  const mode = options.mode ?? resolvePublicUrlMode();
  const baseUrl = options.baseUrl ?? resolvePublicBaseUrl();

  if (mode === "path") {
    if (baseUrl !== undefined) {
      return `${trimTrailingSlash(baseUrl)}${TUNNEL_PATH_PREFIX}/${tunnelId}`;
    }
    const baseDomain = options.baseDomain ?? resolvePublicBaseDomain();
    return `${originForBaseDomain(baseDomain)}${TUNNEL_PATH_PREFIX}/${tunnelId}`;
  }

  const baseDomain = options.baseDomain ?? resolvePublicBaseDomain();
  const host = baseDomain.includes(":") ? baseDomain.split(":")[0]! : baseDomain;
  return `${schemeForHost(host)}://${tunnelSlug(tunnelId)}.${baseDomain}`;
}

/**
 * Resolves an optional full public origin from `BADGER_PUBLIC_BASE_URL`.
 */
export function resolvePublicBaseUrl(): string | undefined {
  const raw = process.env["BADGER_PUBLIC_BASE_URL"]?.trim();
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("expected http(s)");
    }
    return trimTrailingSlash(url.origin);
  } catch {
    throw new Error(
      `Invalid BADGER_PUBLIC_BASE_URL "${raw}": expected an absolute http(s) origin.`,
    );
  }
}

function originForBaseDomain(baseDomain: string): string {
  const host = baseDomain.includes(":") ? (baseDomain.split(":")[0] ?? baseDomain) : baseDomain;
  return `${schemeForHost(host)}://${baseDomain}`;
}

function schemeForHost(host: string): "http" | "https" {
  const normalized = host.toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]") {
    return "http";
  }
  return "https";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
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
 * Prefers `BADGER_PUBLIC_BASE_DOMAIN`. Falls back to deprecated
 * `LOOPLINK_PUBLIC_BASE_DOMAIN` with a warning when only the legacy name is set.
 *
 * @returns A DNS host such as `badger.dev` or a Railway service hostname.
 */
export function resolvePublicBaseDomain(): string {
  const raw = resolveEnvPreferringBadger(
    "BADGER_PUBLIC_BASE_DOMAIN",
    "LOOPLINK_PUBLIC_BASE_DOMAIN",
  );

  if (raw === undefined) {
    return DEFAULT_PUBLIC_BASE_DOMAIN;
  }

  return raw;
}

/**
 * Resolves how public tunnel URLs are minted.
 *
 * Prefers `BADGER_PUBLIC_URL_MODE`. Falls back to deprecated
 * `LOOPLINK_PUBLIC_URL_MODE` with a warning when only the legacy name is set.
 *
 * @returns `path` (default) or `subdomain`.
 */
export function resolvePublicUrlMode(): PublicUrlMode {
  const raw = resolveEnvPreferringBadger("BADGER_PUBLIC_URL_MODE", "LOOPLINK_PUBLIC_URL_MODE");

  if (raw === undefined) {
    return DEFAULT_PUBLIC_URL_MODE;
  }

  const normalized = raw.toLowerCase();
  if (normalized === "path" || normalized === "subdomain") {
    return normalized;
  }

  throw new Error(
    `Invalid public URL mode "${raw}" (BADGER_PUBLIC_URL_MODE / LOOPLINK_PUBLIC_URL_MODE): expected "path" or "subdomain".`,
  );
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
