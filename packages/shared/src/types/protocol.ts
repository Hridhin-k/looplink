/**
 * Discriminator values for every LoopLink protocol message.
 *
 * String enums are used so the wire format stays human-readable JSON and does
 * not depend on TypeScript's numeric enum numbering.
 */
export enum MessageType {
  /** Server → client: the WebSocket session is established. */
  Connected = "connected",
  /** Client → server: request a public tunnel for a local port. */
  CreateTunnel = "create_tunnel",
  /** Server → client: the requested tunnel is ready. */
  TunnelCreated = "tunnel_created",
  /** Server → client (or either direction later): a request or session failed. */
  Error = "error",
  /** Either direction: keepalive probe. */
  Ping = "ping",
  /** Either direction: keepalive reply to a matching {@link PingMessage}. */
  Pong = "pong",

  /** Server → client: begin an HTTP request to forward to localhost. */
  HttpRequestStart = "http_request_start",
  /** Server → client: request body chunk (streaming / binary). */
  HttpRequestChunk = "http_request_chunk",
  /** Server → client: request body stream is complete. */
  HttpRequestEnd = "http_request_end",
  /** Client → server: begin the HTTP response for a forwarded request. */
  HttpResponseStart = "http_response_start",
  /** Client → server: response body chunk (streaming / binary). */
  HttpResponseChunk = "http_response_chunk",
  /** Client → server: response body stream is complete. */
  HttpResponseEnd = "http_response_end",
  /** Either direction: cancel an in-flight HTTP forward. */
  HttpCancel = "http_cancel",
}

/**
 * Fields shared by every LoopLink protocol message.
 *
 * Correlation identifiers (`requestId`) are intentionally not declared here —
 * they belong only on messages that participate in a request/response pair.
 */
export interface BaseMessage {
  /** Message discriminator. */
  readonly type: MessageType;
}

/**
 * Announces that the client WebSocket session is ready.
 *
 * Sent by the server after a successful upgrade. Not correlated to a client
 * request, so it has no `requestId`.
 */
export interface ConnectedMessage extends BaseMessage {
  readonly type: MessageType.Connected;
  /** Server-assigned identifier for this WebSocket session. */
  readonly connectionId: string;
}

/**
 * Asks the server to expose a local TCP port through a public URL.
 */
export interface CreateTunnelMessage extends BaseMessage {
  readonly type: MessageType.CreateTunnel;
  /** Client-generated correlation id for the matching response. */
  readonly requestId: string;
  /** Local TCP port on the client machine to expose. */
  readonly port: number;
}

/**
 * Confirms that a tunnel requested by {@link CreateTunnelMessage} is active.
 */
export interface TunnelCreatedMessage extends BaseMessage {
  readonly type: MessageType.TunnelCreated;
  /** Correlation id matching the originating {@link CreateTunnelMessage}. */
  readonly requestId: string;
  /** Server-assigned identifier for the tunnel session. */
  readonly tunnelId: string;
  /** Public URL clients can use to reach the tunneled local port. */
  readonly publicUrl: string;
}

/**
 * Reports a protocol or session failure.
 *
 * `requestId` is present when the error answers a specific client request and
 * omitted for unsolicited session-level failures.
 */
export interface ErrorMessage extends BaseMessage {
  readonly type: MessageType.Error;
  /** Correlation id of the failed request, when applicable. */
  readonly requestId?: string;
  /** Stable machine-readable error code. */
  readonly code: string;
  /** Human-readable description of the failure. */
  readonly message: string;
}

/**
 * Keepalive probe. The peer should reply with a {@link PongMessage} that reuses
 * the same `requestId`.
 */
export interface PingMessage extends BaseMessage {
  readonly type: MessageType.Ping;
  /** Correlation id echoed by the matching {@link PingMessage}. */
  readonly requestId: string;
}

/**
 * Keepalive reply to a {@link PingMessage}.
 */
export interface PongMessage extends BaseMessage {
  readonly type: MessageType.Pong;
  /** Correlation id matching the originating {@link PingMessage}. */
  readonly requestId: string;
}

/**
 * Discriminated union of tunnel/session control-plane messages.
 */
export type ControlPlaneMessage =
  | ConnectedMessage
  | CreateTunnelMessage
  | TunnelCreatedMessage
  | ErrorMessage
  | PingMessage
  | PongMessage;
