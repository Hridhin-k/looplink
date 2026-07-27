import type { HttpHeaders, HttpMethod } from "../types/http-forwarding.js";

/**
 * Canonical names for Badger lifecycle events.
 *
 * These are internal observability signals — not tunnel protocol messages.
 */
export const BadgerEventType = {
  TunnelCreated: "TunnelCreated",
  TunnelClosed: "TunnelClosed",
  ClientConnected: "ClientConnected",
  ClientDisconnected: "ClientDisconnected",
  RequestReceived: "RequestReceived",
  RequestForwarded: "RequestForwarded",
  ResponseReturned: "ResponseReturned",
  RequestFailed: "RequestFailed",
  ReconnectStarted: "ReconnectStarted",
  ReconnectSucceeded: "ReconnectSucceeded",
} as const;

/**
 * Union of all {@link BadgerEventType} values.
 */
export type BadgerEventType = (typeof BadgerEventType)[keyof typeof BadgerEventType];

/**
 * Why a tunnel session ended.
 *
 * - `unregistered` — removed explicitly (for example by id or client).
 * - `expired` — orphan reclaim window elapsed.
 */
export type TunnelClosedReason = "unregistered" | "expired";

/**
 * Payload for {@link BadgerEventType.TunnelCreated}.
 */
export interface TunnelCreatedEvent {
  /** Server-assigned tunnel identifier. */
  readonly tunnelId: string;
  /** Public URL clients use to reach the tunnel. */
  readonly publicUrl: string;
  /** Local TCP port exposed by the CLI. */
  readonly port: number;
  /** `true` when an orphaned tunnel was reclaimed. */
  readonly restored: boolean;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.TunnelClosed}.
 */
export interface TunnelClosedEvent {
  /** Closed tunnel identifier. */
  readonly tunnelId: string;
  /** Why the tunnel was removed. */
  readonly reason: TunnelClosedReason;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.ClientConnected}.
 */
export interface ClientConnectedEvent {
  /** Server-assigned connection identifier from the handshake. */
  readonly connectionId: string;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.ClientDisconnected}.
 */
export interface ClientDisconnectedEvent {
  /** Handshake connection id when known. */
  readonly connectionId: string | undefined;
  /** Tunnel id that was parked or associated, if any. */
  readonly tunnelId: string | undefined;
  /** `true` when the tunnel was orphaned for reclaim. */
  readonly tunnelDetached: boolean;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.RequestReceived}.
 */
export interface RequestReceivedEvent {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** Inbound request headers (Cookie excluded; see cookies on the wire protocol). */
  readonly headers: HttpHeaders;
  /** Raw request body; empty when the request has no body. */
  readonly body: Uint8Array;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.RequestForwarded}.
 */
export interface RequestForwardedEvent {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.ResponseReturned}.
 */
export interface ResponseReturnedEvent {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** HTTP status returned by the CLI / local app. */
  readonly statusCode: number;
  /** Response headers excluding Set-Cookie. */
  readonly responseHeaders: HttpHeaders;
  /** Assembled response body; empty when the response has no body. */
  readonly responseBody: Uint8Array;
  /** Milliseconds from {@link RequestReceivedEvent.occurredAt} to response completion. */
  readonly latencyMs: number;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.RequestFailed}.
 */
export interface RequestFailedEvent {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id when assigned. */
  readonly requestId: string | undefined;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** Human-readable failure reason. */
  readonly error: string;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.ReconnectStarted}.
 */
export interface ReconnectStartedEvent {
  /** Last known tunnel id, if a session existed. */
  readonly tunnelId: string | undefined;
  /** Last known public URL, if a session existed. */
  readonly publicUrl: string | undefined;
  /** Local port being re-exposed, if a session existed. */
  readonly port: number | undefined;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Payload for {@link BadgerEventType.ReconnectSucceeded}.
 */
export interface ReconnectSucceededEvent {
  /** Active tunnel identifier after reconnect. */
  readonly tunnelId: string;
  /** Public URL after reconnect. */
  readonly publicUrl: string;
  /** Local port being exposed. */
  readonly port: number;
  /** `true` when the previous tunnel id was reclaimed. */
  readonly restored: boolean;
  /** Epoch ms when the event was produced. */
  readonly occurredAt: number;
}

/**
 * Strongly typed map from event name to payload.
 *
 * {@link EventBus.publish} / {@link EventBus.subscribe} use this map so a
 * handler for `TunnelCreated` cannot receive a `RequestFailed` payload.
 */
export interface BadgerEventMap {
  readonly TunnelCreated: TunnelCreatedEvent;
  readonly TunnelClosed: TunnelClosedEvent;
  readonly ClientConnected: ClientConnectedEvent;
  readonly ClientDisconnected: ClientDisconnectedEvent;
  readonly RequestReceived: RequestReceivedEvent;
  readonly RequestForwarded: RequestForwardedEvent;
  readonly ResponseReturned: ResponseReturnedEvent;
  readonly RequestFailed: RequestFailedEvent;
  readonly ReconnectStarted: ReconnectStartedEvent;
  readonly ReconnectSucceeded: ReconnectSucceededEvent;
}
