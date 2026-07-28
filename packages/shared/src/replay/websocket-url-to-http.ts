/**
 * Converts a Badger WebSocket server URL into the HTTP origin used for
 * management APIs (for example request replay).
 *
 * @param websocketUrl - `ws://` or `wss://` server URL.
 * @returns `http://` or `https://` origin (no trailing slash).
 * @throws Error When the URL is invalid or not a WebSocket scheme.
 */
export function websocketUrlToHttpBaseUrl(websocketUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(websocketUrl);
  } catch {
    throw new Error(`Invalid server URL: ${websocketUrl}`);
  }

  if (parsed.protocol === "wss:") {
    parsed.protocol = "https:";
  } else if (parsed.protocol === "ws:") {
    parsed.protocol = "http:";
  } else {
    throw new Error(
      `Expected a WebSocket URL (ws:// or wss://), received protocol "${parsed.protocol}".`,
    );
  }

  return parsed.origin;
}
