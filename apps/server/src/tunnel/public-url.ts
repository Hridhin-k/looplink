/**
 * Default public DNS suffix used when building tunnel URLs.
 */
export const DEFAULT_PUBLIC_BASE_DOMAIN = "looplink.dev";

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
  const slug = tunnelId.replaceAll("-", "").slice(0, 8);
  return `https://${slug}.${baseDomain}`;
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
