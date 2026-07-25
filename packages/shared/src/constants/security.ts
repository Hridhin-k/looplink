/**
 * Maximum WebSocket frame size accepted from CLI clients (bytes).
 *
 * Applied as the `ws` `maxPayload` option. Large enough for a base64-encoded
 * 64 KiB body chunk plus protocol envelope; small enough to bound memory.
 */
export const MAX_WS_MESSAGE_BYTES = 256 * 1024;

/**
 * Maximum HTTP request body accepted on the public data plane (bytes).
 *
 * Enforced by Fastify's `bodyLimit` before the catch-all forwarder runs.
 */
export const MAX_HTTP_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Maximum length of a single protocol string field (path, header value, etc.).
 */
export const MAX_PROTOCOL_STRING_LENGTH = 8 * 1024;

/**
 * Maximum concurrent WebSocket connections to the tunnel gateway.
 */
export const MAX_WS_CONNECTIONS = 1_000;

/**
 * Maximum WebSocket connections allowed from a single client IP.
 */
export const MAX_WS_CONNECTIONS_PER_IP = 50;

/**
 * Maximum protocol messages a single WebSocket may send per window.
 */
export const WS_MESSAGE_RATE_LIMIT = 120;

/**
 * Sliding window length for WebSocket message rate limiting (ms).
 */
export const WS_MESSAGE_RATE_WINDOW_MS = 60_000;

/**
 * Maximum public HTTP requests allowed per IP per window.
 */
export const HTTP_RATE_LIMIT_MAX = 300;

/**
 * Sliding window length for public HTTP rate limiting (ms).
 */
export const HTTP_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Maximum in-flight HTTP forward exchanges across the server.
 */
export const MAX_PENDING_HTTP_EXCHANGES = 500;

/**
 * Maximum buffered response body bytes held per in-flight exchange.
 */
export const MAX_EXCHANGE_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * Hex characters used as the public subdomain slug.
 *
 * 16 hex chars = 64 bits of entropy — enough to resist casual enumeration
 * while staying DNS-label friendly (≤63 octets).
 */
export const TUNNEL_SLUG_LENGTH = 16;

/**
 * Number of random bytes used when minting a tunnel id.
 *
 * Encoded as hex (32 characters). Distinct from {@link TUNNEL_SLUG_LENGTH},
 * which is the public URL prefix of that id.
 */
export const TUNNEL_ID_BYTES = 16;

/**
 * Maximum time Fastify waits for a full request (headers + body) in ms.
 */
export const HTTP_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Maximum time to establish an upstream / local connection in ms.
 */
export const HTTP_CONNECT_TIMEOUT_MS = 10_000;
