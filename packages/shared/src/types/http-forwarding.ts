import { MessageType, type BaseMessage } from "./protocol.js";

/**
 * HTTP methods supported by LoopLink request forwarding.
 */
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

/**
 * Wire encoding for an HTTP body chunk.
 *
 * - `utf8` — `data` is plain text
 * - `base64` — `data` is base64-encoded binary
 */
export type HttpBodyEncoding = "utf8" | "base64";

/**
 * HTTP header map. Values may be repeated (for example multiple `Set-Cookie`
 * or `Accept` entries) by using a string array.
 */
export type HttpHeaders = Readonly<Record<string, string | readonly string[]>>;

/**
 * Parsed query-string parameters. Repeated keys use a string array.
 */
export type HttpQuery = Readonly<Record<string, string | readonly string[]>>;

/**
 * Parsed `Cookie` name/value pairs from an inbound HTTP request.
 */
export type HttpCookies = Readonly<Record<string, string>>;

/**
 * Fields shared by every HTTP forwarding message.
 *
 * `requestId` correlates the full request/response stream. `tunnelId` selects
 * which local tunnel should handle the forward.
 */
export interface HttpForwardingMessageBase extends BaseMessage {
  /** Correlation id for this HTTP exchange. */
  readonly requestId: string;
  /** Tunnel that should service (or that originated) this exchange. */
  readonly tunnelId: string;
}

/**
 * Server → client: opens an HTTP request to be forwarded to localhost.
 *
 * Body bytes follow as {@link HttpRequestChunkMessage} when {@link hasBody} is
 * `true`, then {@link HttpRequestEndMessage}. When `hasBody` is `false`,
 * {@link HttpRequestEndMessage} still follows so receivers share one state machine.
 */
export interface HttpRequestStartMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpRequestStart;
  /** HTTP method to invoke on the local target. */
  readonly method: HttpMethod;
  /** URL pathname only, e.g. `/api/users` (no query string). */
  readonly path: string;
  /** Parsed query parameters. */
  readonly query: HttpQuery;
  /** Request headers (excluding `Cookie`, which is carried in {@link cookies}). */
  readonly headers: HttpHeaders;
  /** Parsed request cookies. */
  readonly cookies: HttpCookies;
  /** When `true`, one or more body chunks will follow before the end frame. */
  readonly hasBody: boolean;
}

/**
 * Server → client: a chunk of the HTTP request body.
 *
 * Chunks are ordered by {@link sequence} starting at `0`. Binary payloads use
 * {@link HttpBodyEncoding} `base64`.
 */
export interface HttpRequestChunkMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpRequestChunk;
  /** Zero-based chunk order within this request body stream. */
  readonly sequence: number;
  /** How {@link data} is encoded on the wire. */
  readonly encoding: HttpBodyEncoding;
  /** Chunk payload (UTF-8 text or base64). */
  readonly data: string;
}

/**
 * Server → client: the request body stream (if any) is finished.
 */
export interface HttpRequestEndMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpRequestEnd;
}

/**
 * Client → server: opens the HTTP response for a forwarded request.
 *
 * Body bytes follow as {@link HttpResponseChunkMessage} when {@link hasBody} is
 * `true`, then {@link HttpResponseEndMessage}.
 */
export interface HttpResponseStartMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpResponseStart;
  /** HTTP status code produced by the local target. */
  readonly statusCode: number;
  /** Response headers (excluding `Set-Cookie`, carried in {@link setCookies}). */
  readonly headers: HttpHeaders;
  /**
   * Raw `Set-Cookie` header values, preserving attributes such as `Path` and
   * `HttpOnly`.
   */
  readonly setCookies: readonly string[];
  /** When `true`, one or more body chunks will follow before the end frame. */
  readonly hasBody: boolean;
}

/**
 * Client → server: a chunk of the HTTP response body.
 *
 * Chunks are ordered by {@link sequence} starting at `0`. Binary payloads use
 * {@link HttpBodyEncoding} `base64`.
 */
export interface HttpResponseChunkMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpResponseChunk;
  /** Zero-based chunk order within this response body stream. */
  readonly sequence: number;
  /** How {@link data} is encoded on the wire. */
  readonly encoding: HttpBodyEncoding;
  /** Chunk payload (UTF-8 text or base64). */
  readonly data: string;
}

/**
 * Client → server: the response body stream (if any) is finished.
 */
export interface HttpResponseEndMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpResponseEnd;
}

/**
 * Either direction: abort an in-flight HTTP forward identified by `requestId`.
 *
 * The receiver should stop reading/writing the local HTTP exchange and release
 * related buffers. A cancel after the exchange has already ended is a no-op.
 */
export interface HttpCancelMessage extends HttpForwardingMessageBase {
  readonly type: MessageType.HttpCancel;
  /** Optional human-readable explanation for logs and diagnostics. */
  readonly reason?: string;
}

/**
 * Discriminated union of HTTP data-plane forwarding messages.
 */
export type HttpForwardingMessage =
  | HttpRequestStartMessage
  | HttpRequestChunkMessage
  | HttpRequestEndMessage
  | HttpResponseStartMessage
  | HttpResponseChunkMessage
  | HttpResponseEndMessage
  | HttpCancelMessage;
