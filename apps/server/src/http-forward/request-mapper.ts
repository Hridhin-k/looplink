import { HttpMethod, type HttpCookies, type HttpHeaders, type HttpQuery } from "@looplink/shared";
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
]);

/**
 * Maps a Fastify request into LoopLink HTTP forwarding fields.
 *
 * @param request - Inbound Fastify request (body parsed as Buffer when present).
 * @returns Normalized request fields.
 * @throws Error When the HTTP method is unsupported.
 */
export function mapFastifyRequest(request: FastifyRequest): MappedHttpRequest {
  const method = parseMethod(request.method);
  const path = request.url.split("?")[0] ?? "/";
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
    if (typeof value === "string") {
      result[key] = value;
    } else if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
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

    result[name] = value;
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

    const name = decodeURIComponent(trimmed.slice(0, separator).trim());
    const value = decodeURIComponent(trimmed.slice(separator + 1).trim());
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
