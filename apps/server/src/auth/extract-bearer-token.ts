/**
 * Extracts a Bearer access token from an Authorization header value.
 *
 * @param authorization - Raw `Authorization` header, or undefined.
 * @returns The token string, or `undefined` when absent/malformed.
 */
export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  if (token === undefined || token.length === 0) {
    return undefined;
  }
  return token;
}
