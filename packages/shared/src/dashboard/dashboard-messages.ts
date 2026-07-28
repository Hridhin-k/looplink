import type { StatisticsUpdatedSnapshot } from "../event-bus/badger-events.js";
import type { HttpMethod } from "../types/http-forwarding.js";

/**
 * Wire message types for the dashboard live WebSocket (`/dashboard/ws`).
 *
 * These are not tunnel protocol frames.
 */
export const DashboardMessageType = {
  Connected: "connected",
  Ping: "ping",
  Pong: "pong",
  TunnelConnected: "tunnel_connected",
  TunnelDisconnected: "tunnel_disconnected",
  RequestReceived: "request_received",
  ResponseCompleted: "response_completed",
  ReplayCompleted: "replay_completed",
  StatisticsUpdated: "statistics_updated",
} as const;

/**
 * Union of {@link DashboardMessageType} values.
 */
export type DashboardMessageType = (typeof DashboardMessageType)[keyof typeof DashboardMessageType];

/**
 * Base fields on every dashboard live message.
 */
export interface DashboardMessageBase {
  readonly type: DashboardMessageType;
  /** Epoch ms when the message was produced. */
  readonly occurredAt: number;
}

/**
 * Sent once when a dashboard client finishes the WebSocket handshake.
 */
export interface DashboardConnectedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.Connected;
  readonly connectionId: string;
}

/**
 * Server → client liveness probe.
 */
export interface DashboardPingMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.Ping;
}

/**
 * Client → server liveness reply.
 */
export interface DashboardPongMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.Pong;
}

/**
 * A tunnel session became available.
 */
export interface DashboardTunnelConnectedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.TunnelConnected;
  readonly tunnelId: string;
  readonly publicUrl: string;
  readonly port: number;
  readonly restored: boolean;
}

/**
 * A tunnel session ended.
 */
export interface DashboardTunnelDisconnectedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.TunnelDisconnected;
  readonly tunnelId: string;
  readonly reason: string;
}

/**
 * An HTTP request was received for forwarding.
 */
export interface DashboardRequestReceivedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.RequestReceived;
  readonly requestId: string;
  readonly tunnelId: string;
  readonly method: HttpMethod;
  readonly path: string;
}

/**
 * An HTTP response completed for a forwarded request.
 */
export interface DashboardResponseCompletedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.ResponseCompleted;
  readonly requestId: string;
  readonly tunnelId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly statusCode: number;
  readonly latencyMs: number;
}

/**
 * A recorded request was replayed successfully.
 */
export interface DashboardReplayCompletedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.ReplayCompleted;
  readonly requestId: string;
  readonly tunnelId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly statusCode: number;
}

/**
 * Aggregate traffic statistics were recomputed.
 */
export interface DashboardStatisticsUpdatedMessage extends DashboardMessageBase {
  readonly type: typeof DashboardMessageType.StatisticsUpdated;
  readonly statistics: StatisticsUpdatedSnapshot;
  readonly tunnelId: string | undefined;
}

/**
 * Union of all dashboard live messages.
 */
export type DashboardMessage =
  | DashboardConnectedMessage
  | DashboardPingMessage
  | DashboardPongMessage
  | DashboardTunnelConnectedMessage
  | DashboardTunnelDisconnectedMessage
  | DashboardRequestReceivedMessage
  | DashboardResponseCompletedMessage
  | DashboardReplayCompletedMessage
  | DashboardStatisticsUpdatedMessage;

/**
 * WebSocket path for the dashboard live channel (server-relative).
 */
export const DASHBOARD_WS_PATH = "/dashboard/ws";
