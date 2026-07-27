import { Readable } from "node:stream";

import type { HttpCookies, HttpHeaders, HttpMethod, HttpQuery } from "@hridhin-k/badger-shared";
import { request, type Dispatcher } from "undici";

/** Hop-by-hop / unsafe headers that must not be forwarded to localhost. */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
]);

/**
 * A forwarded HTTP request ready to be sent to a local target.
 */
export interface LocalProxyRequest {
  /** HTTP method. */
  readonly method: HttpMethod;
  /** URL pathname, e.g. `/api/users`. */
  readonly path: string;
  /** Query parameters to append to the URL. */
  readonly query: HttpQuery;
  /** Request headers (excluding `Cookie`). */
  readonly headers: HttpHeaders;
  /** Parsed cookies, serialized into the `Cookie` header. */
  readonly cookies: HttpCookies;
  /** Optional request body (buffered or streaming). */
  readonly body?: Uint8Array | string | AsyncIterable<Uint8Array>;
  /** Optional abort signal for cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * A local HTTP response with a streaming body.
 */
export interface LocalProxyResponse {
  /** HTTP status code from the local target. */
  readonly statusCode: number;
  /** Response headers excluding `Set-Cookie`. */
  readonly headers: HttpHeaders;
  /** Raw `Set-Cookie` header values. */
  readonly setCookies: readonly string[];
  /** Streaming response body. */
  readonly body: AsyncIterable<Uint8Array>;
}

/**
 * Configuration for {@link LocalProxy}.
 */
export interface LocalProxyOptions {
  /** Hostname of the local target. Defaults to `127.0.0.1`. */
  readonly host?: string;
  /**
   * Optional undici dispatcher.
   *
   * Injected in tests (for example {@link import("undici").MockAgent}) so the
   * proxy can run without opening real sockets.
   */
  readonly dispatcher?: Dispatcher;
}

/**
 * Forwards HTTP requests to a process listening on localhost.
 */
export class LocalProxy {
  private readonly host: string;
  private readonly dispatcher: Dispatcher | undefined;

  /**
   * @param options - Local target host and optional undici dispatcher.
   */
  constructor(options: LocalProxyOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.dispatcher = options.dispatcher;
  }

  /**
   * Sends a forwarded HTTP request to `http://{host}:{port}` and returns the
   * streaming response.
   *
   * @param port - Local TCP port to target.
   * @param proxyRequest - Method, path, headers, cookies, and optional body.
   * @returns Status, headers, set-cookies, and a streaming body.
   */
  async forward(port: number, proxyRequest: LocalProxyRequest): Promise<LocalProxyResponse> {
    const url = buildLocalUrl(this.host, port, proxyRequest.path, proxyRequest.query);
    const headers = buildRequestHeaders(
      proxyRequest.headers,
      proxyRequest.cookies,
      this.host,
      port,
    );
    const body = toUndiciBody(proxyRequest.body);

    const requestOptions: {
      method: HttpMethod;
      headers: Record<string, string | string[]>;
      body?: string | Buffer | Readable;
      signal?: AbortSignal;
      dispatcher?: Dispatcher;
    } = {
      method: proxyRequest.method,
      headers,
    };

    if (body !== undefined) {
      requestOptions.body = body;
    }

    if (proxyRequest.signal !== undefined) {
      requestOptions.signal = proxyRequest.signal;
    }

    if (this.dispatcher !== undefined) {
      requestOptions.dispatcher = this.dispatcher;
    }

    const response = await request(url, requestOptions);

    const { headers: responseHeaders, setCookies } = splitResponseHeaders(response.headers);

    return {
      statusCode: response.statusCode,
      headers: responseHeaders,
      setCookies,
      body: iterateBody(response.body),
    };
  }
}

/**
 * Builds an absolute local URL from host, port, path, and query.
 *
 * @param host - Local hostname.
 * @param port - Local TCP port.
 * @param path - URL pathname.
 * @param query - Query parameters.
 * @returns Absolute `http://` URL string.
 */
export function buildLocalUrl(host: string, port: number, path: string, query: HttpQuery): string {
  const normalizedPath = path.length === 0 || path.startsWith("/") ? path : `/${path}`;
  const pathname = normalizedPath.length === 0 ? "/" : normalizedPath;
  const url = new URL(pathname, `http://${host}:${String(port)}`);

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      url.searchParams.append(key, value);
    } else {
      for (const entry of value) {
        url.searchParams.append(key, entry);
      }
    }
  }

  return url.toString();
}

/**
 * Builds outbound request headers, applying cookie serialization and stripping
 * hop-by-hop headers.
 *
 * @param headers - Incoming header map.
 * @param cookies - Parsed cookies.
 * @param host - Local hostname for the `Host` header.
 * @param port - Local port for the `Host` header.
 * @returns Header record suitable for undici.
 */
export function buildRequestHeaders(
  headers: HttpHeaders,
  cookies: HttpCookies,
  host: string,
  port: number,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {
    host: `${host}:${String(port)}`,
  };

  for (const [name, value] of Object.entries(headers)) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    if (typeof value === "string") {
      result[name] = value;
    } else {
      result[name] = [...value];
    }
  }

  const cookieHeader = serializeCookies(cookies);
  if (cookieHeader !== undefined) {
    result["cookie"] = cookieHeader;
  }

  return result;
}

/**
 * Splits undici response headers into a protocol header map and `Set-Cookie` values.
 *
 * @param headers - Raw undici response headers.
 * @returns Normalized headers and set-cookie list.
 */
export function splitResponseHeaders(headers: Record<string, string | string[] | undefined>): {
  headers: HttpHeaders;
  setCookies: readonly string[];
} {
  const normalized: Record<string, string | readonly string[]> = {};
  let setCookies: readonly string[] = [];

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (name.toLowerCase() === "set-cookie") {
      setCookies = Array.isArray(value) ? value : [value];
      continue;
    }

    normalized[name] = value;
  }

  return { headers: normalized, setCookies };
}

function serializeCookies(cookies: HttpCookies): string | undefined {
  const pairs = Object.entries(cookies).map(
    ([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
  );

  if (pairs.length === 0) {
    return undefined;
  }

  return pairs.join("; ");
}

function toUndiciBody(
  body: Uint8Array | string | AsyncIterable<Uint8Array> | undefined,
): string | Buffer | Readable | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === "string" || body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  return Readable.from(mapChunks(body));
}

async function* mapChunks(body: AsyncIterable<Uint8Array>): AsyncIterable<Buffer> {
  for await (const chunk of body) {
    yield Buffer.from(chunk);
  }
}

async function* iterateBody(body: AsyncIterable<Buffer | string>): AsyncIterable<Uint8Array> {
  for await (const chunk of body) {
    yield chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
  }
}
