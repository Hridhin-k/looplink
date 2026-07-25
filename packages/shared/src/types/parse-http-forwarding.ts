import type { Result } from "./result.js";
import { err, ok } from "../utils/result.js";
import {
  HttpMethod,
  type HttpBodyEncoding,
  type HttpCancelMessage,
  type HttpCookies,
  type HttpForwardingMessage,
  type HttpHeaders,
  type HttpQuery,
  type HttpRequestChunkMessage,
  type HttpRequestEndMessage,
  type HttpRequestStartMessage,
  type HttpResponseChunkMessage,
  type HttpResponseEndMessage,
  type HttpResponseStartMessage,
} from "./http-forwarding.js";
import { MessageType } from "./protocol.js";

/**
 * Parses an HTTP forwarding protocol message from a JSON object record.
 *
 * @param type - Already-validated {@link MessageType}.
 * @param record - Raw JSON object fields.
 * @returns A typed forwarding message, or a parse error.
 */
export function parseHttpForwardingMessage(
  type: MessageType,
  record: Record<string, unknown>,
): Result<HttpForwardingMessage, string> {
  switch (type) {
    case MessageType.HttpRequestStart:
      return parseRequestStart(record);
    case MessageType.HttpRequestChunk:
      return parseRequestChunk(record);
    case MessageType.HttpRequestEnd:
      return parseRequestEnd(record);
    case MessageType.HttpResponseStart:
      return parseResponseStart(record);
    case MessageType.HttpResponseChunk:
      return parseResponseChunk(record);
    case MessageType.HttpResponseEnd:
      return parseResponseEnd(record);
    case MessageType.HttpCancel:
      return parseCancel(record);
    default:
      return err(`Not an HTTP forwarding message type "${type}".`);
  }
}

/**
 * Returns whether a message type belongs to the HTTP forwarding data plane.
 *
 * @param type - Protocol discriminator.
 * @returns `true` for HTTP forwarding frames.
 */
export function isHttpForwardingMessageType(type: MessageType): boolean {
  switch (type) {
    case MessageType.HttpRequestStart:
    case MessageType.HttpRequestChunk:
    case MessageType.HttpRequestEnd:
    case MessageType.HttpResponseStart:
    case MessageType.HttpResponseChunk:
    case MessageType.HttpResponseEnd:
    case MessageType.HttpCancel:
      return true;
    default:
      return false;
  }
}

function requireRequestMeta(
  record: Record<string, unknown>,
): Result<{ requestId: string; tunnelId: string }, string> {
  const requestId = record["requestId"];
  const tunnelId = record["tunnelId"];

  if (typeof requestId !== "string" || requestId.length === 0) {
    return err("HTTP forwarding message requires a non-empty requestId.");
  }

  if (typeof tunnelId !== "string" || tunnelId.length === 0) {
    return err("HTTP forwarding message requires a non-empty tunnelId.");
  }

  return ok({ requestId, tunnelId });
}

function parseRequestStart(
  record: Record<string, unknown>,
): Result<HttpRequestStartMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  const method = record["method"];
  if (!isHttpMethod(method)) {
    return err("HttpRequestStart requires a supported HTTP method.");
  }

  const path = record["path"];
  if (typeof path !== "string") {
    return err("HttpRequestStart requires a string path.");
  }

  const query = parseQuery(record["query"]);
  if (!query.ok) {
    return query;
  }

  const headers = parseHeaders(record["headers"]);
  if (!headers.ok) {
    return headers;
  }

  const cookies = parseCookies(record["cookies"]);
  if (!cookies.ok) {
    return cookies;
  }

  const hasBody = record["hasBody"];
  if (typeof hasBody !== "boolean") {
    return err("HttpRequestStart requires a boolean hasBody.");
  }

  return ok({
    type: MessageType.HttpRequestStart,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
    method,
    path,
    query: query.value,
    headers: headers.value,
    cookies: cookies.value,
    hasBody,
  });
}

function parseRequestChunk(
  record: Record<string, unknown>,
): Result<HttpRequestChunkMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  const chunk = parseChunkFields(record);
  if (!chunk.ok) {
    return chunk;
  }

  return ok({
    type: MessageType.HttpRequestChunk,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
    ...chunk.value,
  });
}

function parseRequestEnd(record: Record<string, unknown>): Result<HttpRequestEndMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  return ok({
    type: MessageType.HttpRequestEnd,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
  });
}

function parseResponseStart(
  record: Record<string, unknown>,
): Result<HttpResponseStartMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  const statusCode = record["statusCode"];
  if (typeof statusCode !== "number" || !Number.isInteger(statusCode) || statusCode < 100) {
    return err("HttpResponseStart requires an integer statusCode >= 100.");
  }

  const headers = parseHeaders(record["headers"]);
  if (!headers.ok) {
    return headers;
  }

  const setCookies = parseStringArray(record["setCookies"]);
  if (!setCookies.ok) {
    return err("HttpResponseStart requires a string array setCookies.");
  }

  const hasBody = record["hasBody"];
  if (typeof hasBody !== "boolean") {
    return err("HttpResponseStart requires a boolean hasBody.");
  }

  return ok({
    type: MessageType.HttpResponseStart,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
    statusCode,
    headers: headers.value,
    setCookies: setCookies.value,
    hasBody,
  });
}

function parseResponseChunk(
  record: Record<string, unknown>,
): Result<HttpResponseChunkMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  const chunk = parseChunkFields(record);
  if (!chunk.ok) {
    return chunk;
  }

  return ok({
    type: MessageType.HttpResponseChunk,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
    ...chunk.value,
  });
}

function parseResponseEnd(record: Record<string, unknown>): Result<HttpResponseEndMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  return ok({
    type: MessageType.HttpResponseEnd,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
  });
}

function parseCancel(record: Record<string, unknown>): Result<HttpCancelMessage, string> {
  const meta = requireRequestMeta(record);
  if (!meta.ok) {
    return meta;
  }

  const reason = record["reason"];
  if (reason !== undefined && (typeof reason !== "string" || reason.length === 0)) {
    return err("HttpCancel reason must be a non-empty string when present.");
  }

  if (typeof reason === "string") {
    return ok({
      type: MessageType.HttpCancel,
      requestId: meta.value.requestId,
      tunnelId: meta.value.tunnelId,
      reason,
    });
  }

  return ok({
    type: MessageType.HttpCancel,
    requestId: meta.value.requestId,
    tunnelId: meta.value.tunnelId,
  });
}

function parseChunkFields(
  record: Record<string, unknown>,
): Result<{ sequence: number; encoding: HttpBodyEncoding; data: string }, string> {
  const sequence = record["sequence"];
  const encoding = record["encoding"];
  const data = record["data"];

  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
    return err("HTTP chunk requires a non-negative integer sequence.");
  }

  if (encoding !== "utf8" && encoding !== "base64") {
    return err('HTTP chunk encoding must be "utf8" or "base64".');
  }

  if (typeof data !== "string") {
    return err("HTTP chunk requires string data.");
  }

  return ok({ sequence, encoding, data });
}

function parseHeaders(value: unknown): Result<HttpHeaders, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err("headers must be an object.");
  }

  const result: Record<string, string | readonly string[]> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") {
      result[key] = entry;
      continue;
    }

    const asArray = parseStringArray(entry);
    if (!asArray.ok) {
      return err(`headers.${key} must be a string or string array.`);
    }

    result[key] = asArray.value;
  }

  return ok(result);
}

function parseQuery(value: unknown): Result<HttpQuery, string> {
  return parseHeaders(value);
}

function parseCookies(value: unknown): Result<HttpCookies, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err("cookies must be an object.");
  }

  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") {
      return err(`cookies.${key} must be a string.`);
    }
    result[key] = entry;
  }

  return ok(result);
}

function parseStringArray(value: unknown): Result<readonly string[], string> {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return err("expected a string array");
  }

  return ok(value as string[]);
}

function isHttpMethod(value: unknown): value is HttpMethod {
  return (
    value === HttpMethod.GET ||
    value === HttpMethod.POST ||
    value === HttpMethod.PUT ||
    value === HttpMethod.PATCH ||
    value === HttpMethod.DELETE
  );
}
