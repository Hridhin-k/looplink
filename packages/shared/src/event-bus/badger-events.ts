import type { TrafficBody } from "../traffic/traffic-body.js";
import type { HttpHeaders, HttpMethod, HttpQuery } from "../types/http-forwarding.js";

/**
 * Fields present on every Badger lifecycle event.
 *
 * Events are immutable value objects. Publishers must treat payloads as
 * read-only after {@link import("./create-event-payload.js").createEventPayload}.
 */
export interface BadgerEventBase {
  /** Unique id for this event instance. */
  readonly eventId: string;
  /** Epoch milliseconds when the event was produced. */
  readonly occurredAt: number;
  /**
   * Correlates related events in a flow (typically an HTTP `requestId`, or a
   * connection id for session-level events).
   */
  readonly correlationId: string | undefined;
}

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
  ReplayCompleted: "ReplayCompleted",
  StatisticsUpdated: "StatisticsUpdated",
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
export interface TunnelCreatedEvent extends BadgerEventBase {
  /** Server-assigned tunnel identifier. */
  readonly tunnelId: string;
  /** Public URL clients use to reach the tunnel. */
  readonly publicUrl: string;
  /** Local TCP port exposed by the CLI. */
  readonly port: number;
  /** `true` when an orphaned tunnel was reclaimed. */
  readonly restored: boolean;
  /** Workspace that owns this tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Payload for {@link BadgerEventType.TunnelClosed}.
 */
export interface TunnelClosedEvent extends BadgerEventBase {
  /** Closed tunnel identifier. */
  readonly tunnelId: string;
  /** Why the tunnel was removed. */
  readonly reason: TunnelClosedReason;
}

/**
 * Payload for {@link BadgerEventType.ClientConnected}.
 */
export interface ClientConnectedEvent extends BadgerEventBase {
  /** Server-assigned connection identifier from the handshake. */
  readonly connectionId: string;
}

/**
 * Payload for {@link BadgerEventType.ClientDisconnected}.
 */
export interface ClientDisconnectedEvent extends BadgerEventBase {
  /** Handshake connection id when known. */
  readonly connectionId: string | undefined;
  /** Tunnel id that was parked or associated, if any. */
  readonly tunnelId: string | undefined;
  /** `true` when the tunnel was orphaned for reclaim. */
  readonly tunnelDetached: boolean;
}

/**
 * Payload for {@link BadgerEventType.RequestReceived}.
 *
 * Publishers should truncate oversized bodies with
 * {@link import("../traffic/traffic-body.js").createTrafficBody} before publish.
 */
export interface RequestReceivedEvent extends BadgerEventBase {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** Inbound request headers. */
  readonly headers: HttpHeaders;
  /** Parsed query-string parameters. */
  readonly query: HttpQuery;
  /** Request body snapshot (may be truncated). */
  readonly body: TrafficBody;
  /** Workspace that owns the tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Payload for {@link BadgerEventType.RequestForwarded}.
 */
export interface RequestForwardedEvent extends BadgerEventBase {
  /** Target tunnel identifier. */
  readonly tunnelId: string;
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Inbound HTTP method. */
  readonly method: HttpMethod;
  /** Path forwarded to the local application. */
  readonly path: string;
  /** Workspace that owns the tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Payload for {@link BadgerEventType.ResponseReturned}.
 *
 * Publishers should truncate oversized bodies with
 * {@link import("../traffic/traffic-body.js").createTrafficBody} before publish.
 */
export interface ResponseReturnedEvent extends BadgerEventBase {
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
  /** Response headers. */
  readonly responseHeaders: HttpHeaders;
  /** Response body snapshot (may be truncated). */
  readonly responseBody: TrafficBody;
  /** Milliseconds from request receipt to response completion. */
  readonly latencyMs: number;
  /** Workspace that owns the tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Payload for {@link BadgerEventType.RequestFailed}.
 */
export interface RequestFailedEvent extends BadgerEventBase {
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
  /** Workspace that owns the tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Payload for {@link BadgerEventType.ReconnectStarted}.
 */
export interface ReconnectStartedEvent extends BadgerEventBase {
  /** Last known tunnel id, if a session existed. */
  readonly tunnelId: string | undefined;
  /** Last known public URL, if a session existed. */
  readonly publicUrl: string | undefined;
  /** Local port being re-exposed, if a session existed. */
  readonly port: number | undefined;
}

/**
 * Payload for {@link BadgerEventType.ReconnectSucceeded}.
 */
export interface ReconnectSucceededEvent extends BadgerEventBase {
  /** Active tunnel identifier after reconnect. */
  readonly tunnelId: string;
  /** Public URL after reconnect. */
  readonly publicUrl: string;
  /** Local port being exposed. */
  readonly port: number;
  /** `true` when the previous tunnel id was reclaimed. */
  readonly restored: boolean;
}

/**
 * Payload for {@link BadgerEventType.ReplayCompleted}.
 */
export interface ReplayCompletedEvent extends BadgerEventBase {
  /** Original traffic request id that was replayed. */
  readonly requestId: string;
  /** Tunnel used for the replay. */
  readonly tunnelId: string;
  /** HTTP method replayed. */
  readonly method: HttpMethod;
  /** Path replayed. */
  readonly path: string;
  /** Live status code returned by the local app. */
  readonly statusCode: number;
  /** Workspace that owned the replayed tunnel/request (legacy: absent). */
  readonly workspaceId?: string;
}

/**
 * Compact statistics snapshot carried on {@link BadgerEventType.StatisticsUpdated}.
 */
export interface StatisticsUpdatedSnapshot {
  readonly totalRequests: number;
  readonly requestsPerMinute: number;
  readonly averageLatencyMs: number | undefined;
  readonly p95LatencyMs: number | undefined;
  readonly errorRate: number;
}

/**
 * Payload for {@link BadgerEventType.StatisticsUpdated}.
 */
export interface StatisticsUpdatedEvent extends BadgerEventBase {
  /** Latest aggregate statistics snapshot. */
  readonly statistics: StatisticsUpdatedSnapshot;
  /** Optional tunnel scope when stats were computed for one tunnel. */
  readonly tunnelId: string | undefined;
  /** Optional workspace scope when stats were computed for one workspace. */
  readonly workspaceId?: string;
}

/**
 * Strongly typed map from event name to payload.
 *
 * {@link import("./event-bus.js").EventBus.publish} /
 * {@link import("./event-bus.js").EventBus.subscribe} use this map so a
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
  readonly ReplayCompleted: ReplayCompletedEvent;
  readonly StatisticsUpdated: StatisticsUpdatedEvent;
}
