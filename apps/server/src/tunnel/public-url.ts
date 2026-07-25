/**
 * Default public DNS suffix used when building tunnel URLs.
 */
export const DEFAULT_PUBLIC_BASE_DOMAIN = "looplink.dev";

/** Number of hex characters used as the public subdomain slug. */
export const TUNNEL_SLUG_LENGTH = 8;

/**
 * Derives the public subdomain slug from a tunnel id.
 *
 * @param tunnelId - Unique tunnel identifier.
 * @returns An 8-character hex slug.
 */
export function tunnelSlug(tunnelId: string): string {
  return tunnelId.replaceAll("-", "").slice(0, TUNNEL_SLUG_LENGTH);
}

/**
 * Builds the public HTTPS URL for a tunnel id.
 *
 * @param tunnelId - Unique tunnel identifier.
 * @param baseDomain - Public DNS suffix (default {@link DEFAULT_PUBLIC_BASE_DOMAIN}).
 * @returns A URL of the form `https://{slug}.{baseDomain}`.
 */
export function buildPublicUrl(
  tunnelId: string,
  baseDomain: string = DEFAULT_PUBLIC_BASE_DOMAIN,
): string {
  return `https://${tunnelSlug(tunnelId)}.${baseDomain}`;
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
 * @returns A DNS suffix such as `looplink.dev`.
 */
export function resolvePublicBaseDomain(): string {
  const raw = process.env["LOOPLINK_PUBLIC_BASE_DOMAIN"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_PUBLIC_BASE_DOMAIN;
  }

  return raw.trim();
}
