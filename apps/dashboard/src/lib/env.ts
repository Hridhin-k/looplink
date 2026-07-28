/**
 * Public dashboard environment (browser-safe).
 *
 * `NEXT_PUBLIC_BADGER_API_URL` should be the Badger server HTTP origin
 * (default `http://localhost:8080`). The WebSocket URL is derived from it.
 */
export function getApiBaseUrl(): string {
  const raw = process.env["NEXT_PUBLIC_BADGER_API_URL"]?.trim();
  if (raw === undefined || raw.length === 0) {
    return "http://localhost:8080";
  }

  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_BADGER_API_URL "${raw}": expected an absolute http(s) URL.`,
    );
  }
}

/**
 * @returns Absolute WebSocket URL for `/dashboard/ws`.
 */
export function getDashboardWebSocketUrl(): string {
  const raw = process.env["NEXT_PUBLIC_BADGER_WS_URL"]?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw;
  }

  return getApiBaseUrl();
}
