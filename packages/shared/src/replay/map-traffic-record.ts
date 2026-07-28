import type { HttpCookies, HttpHeaders, HttpMethod, HttpQuery } from "../types/http-forwarding.js";
import { trafficBodyToBytes } from "../traffic/traffic-body.js";
import type { TrafficRecord } from "../traffic/traffic-record.js";
import { REPLAYABLE_HTTP_METHODS, ReplayError, ReplayErrorCode } from "./replay-types.js";

/**
 * Forward-pipeline fields reconstructed from a {@link TrafficRecord}.
 *
 * Intentionally mirrors the inputs expected by the server
 * {@link HttpForwardingService} without importing Nest types.
 */
export interface ReplayForwardRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly query: HttpQuery;
  readonly headers: HttpHeaders;
  readonly cookies: HttpCookies;
  readonly body: Uint8Array | undefined;
  readonly requestBodyTruncated: boolean;
}

/**
 * Maps a recorded exchange into forwardable HTTP fields.
 *
 * @param record - Stored traffic record.
 * @returns Fields suitable for {@link HttpForwardingService.forward}.
 * @throws ReplayError When the method is not replayable.
 */
export function mapTrafficRecordToForwardRequest(record: TrafficRecord): ReplayForwardRequest {
  assertReplayableMethod(record.method);

  const { headers, cookies } = splitHeadersAndCookies(record.headers);
  const bodyBytes = trafficBodyToBytes(record.body);
  const body = bodyBytes.byteLength === 0 ? undefined : bodyBytes;

  return {
    method: record.method,
    path: record.path,
    query: record.query,
    headers,
    cookies,
    body,
    requestBodyTruncated: record.body.truncated,
  };
}

/**
 * Ensures `method` is one of the replayable HTTP verbs.
 *
 * @param method - Candidate method.
 * @throws ReplayError When unsupported.
 */
export function assertReplayableMethod(method: HttpMethod): void {
  if (!REPLAYABLE_HTTP_METHODS.includes(method)) {
    throw new ReplayError(
      ReplayErrorCode.UnsupportedMethod,
      `Unsupported HTTP method for replay: ${method}.`,
    );
  }
}

/**
 * Splits a Cookie header out of the header map into the cookies object used by
 * the forward protocol.
 *
 * @param headers - Recorded request headers.
 * @returns Headers without Cookie, plus parsed cookie pairs.
 */
function splitHeadersAndCookies(headers: HttpHeaders): {
  headers: HttpHeaders;
  cookies: HttpCookies;
} {
  const next: Record<string, string | readonly string[]> = {};
  let cookies: HttpCookies = {};

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "cookie") {
      const raw = typeof value === "string" ? value : value.join("; ");
      cookies = parseCookieHeader(raw);
      continue;
    }

    next[name] = value;
  }

  return { headers: next, cookies };
}

/**
 * Parses a Cookie header into name/value pairs.
 *
 * @param header - Raw Cookie header.
 * @returns Cookie map.
 */
function parseCookieHeader(header: string): HttpCookies {
  if (header.trim().length === 0) {
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

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (name.length === 0) {
      continue;
    }

    result[name] = value;
  }

  return result;
}
