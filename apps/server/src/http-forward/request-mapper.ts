import {
  HttpMethod,
  MAX_PROTOCOL_STRING_LENGTH,
  type HttpCookies,
  type HttpHeaders,
  type HttpQuery,
} from "@looplink/shared";
import type { FastifyRequest } from "fastify";

/**
 * Normalized fields extracted from an inbound Fastify request.
 */
export interface MappedHttpRequest {
  /** HTTP method, when supported. */
  readonly method: HttpMethod;
  /** URL pathname. */
  readonly path: string;
  /** Query parameters. */
  readonly query: HttpQuery;
  /** Headers excluding Cookie and hop-by-hop headers. */
  readonly headers: HttpHeaders;
  /** Parsed Cookie pairs. */
  readonly cookies: HttpCookies;
  /** Raw body bytes, when present. */
  readonly body: Uint8Array | undefined;
}

/** Hop-by-hop / proxy headers that should not be forwarded to the CLI. */
const STRIP_REQUEST_HEADERS = new Set([
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
  // Client-supplied forwarding headers are spoofable on the public edge.
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "forwarded",
]);

/**
 * Maps a Fastify request into LoopLink HTTP forwarding fields.
 *
 * @param request - Inbound Fastify request (body parsed as Buffer when present).
 * @returns Normalized request fields.
 * @throws Error When the HTTP method is unsupported or fields fail validation.
 */
export function mapFastifyRequest(request: FastifyRequest): MappedHttpRequest {
  const method = parseMethod(request.method);
  const path = request.url.split("?")[0] ?? "/";
  assertBoundedString("path", path);

  const query = mapQuery(request.query);
  const cookies = parseCookieHeader(headerValue(request.headers.cookie));
  const headers = mapHeaders(request.headers);
  const body = mapBody(request.body);

  return { method, path, query, headers, cookies, body };
}

function parseMethod(method: string): HttpMethod {
  const normalized = method.toUpperCase();

  if (normalized === "GET") {
    return HttpMethod.GET;
  }
  if (normalized === "POST") {
    return HttpMethod.POST;
  }
  if (normalized === "PUT") {
    return HttpMethod.PUT;
  }
  if (normalized === "PATCH") {
    return HttpMethod.PATCH;
  }
  if (normalized === "DELETE") {
    return HttpMethod.DELETE;
  }

  throw new Error(`Unsupported HTTP method "${method}".`);
}

function mapQuery(query: unknown): HttpQuery {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return {};
  }

  const result: Record<string, string | readonly string[]> = {};

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    assertBoundedString("query key", key);
    if (typeof value === "string") {
      assertBoundedString("query value", value);
      result[key] = value;
    } else if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      for (const entry of value) {
        assertBoundedString("query value", entry);
      }
      result[key] = value;
    }
  }

  return result;
}

function mapHeaders(headers: FastifyRequest["headers"]): HttpHeaders {
  const result: Record<string, string | readonly string[]> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || STRIP_REQUEST_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    assertBoundedString("header name", name);
    if (typeof value === "string") {
      assertBoundedString("header value", value);
      result[name] = value;
    } else {
      for (const entry of value) {
        assertBoundedString("header value", entry);
      }
      result[name] = value;
    }
  }

  return result;
}

function parseCookieHeader(header: string | undefined): HttpCookies {
  if (header === undefined || header.trim().length === 0) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(trimmed.slice(0, separator).trim());
      value = decodeURIComponent(trimmed.slice(separator + 1).trim());
    } catch {
      throw new Error("Malformed Cookie header encoding.");
    }

    assertBoundedString("cookie name", name);
    assertBoundedString("cookie value", value);
    result[name] = value;
  }

  return result;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function mapBody(body: unknown): Uint8Array | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (Buffer.isBuffer(body)) {
    return body.byteLength === 0 ? undefined : body;
  }

  if (body instanceof Uint8Array) {
    return body.byteLength === 0 ? undefined : body;
  }

  if (typeof body === "string") {
    return body.length === 0 ? undefined : Buffer.from(body);
  }

  return undefined;
}

/**
 * Rejects protocol strings that exceed the shared length ceiling.
 *
 * @param label - Field name for the error message.
 * @param value - Candidate string.
 */
function assertBoundedString(label: string, value: string): void {
  if (value.length > MAX_PROTOCOL_STRING_LENGTH) {
    throw new Error(
      `${label} exceeds maximum length of ${String(MAX_PROTOCOL_STRING_LENGTH)} characters.`,
    );
  }
}
