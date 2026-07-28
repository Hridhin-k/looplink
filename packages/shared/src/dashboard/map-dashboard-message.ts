import type {
  ReplayCompletedEvent,
  RequestReceivedEvent,
  ResponseReturnedEvent,
  StatisticsUpdatedEvent,
  TunnelClosedEvent,
  TunnelCreatedEvent,
} from "../event-bus/badger-events.js";
import {
  DashboardMessageType,
  type DashboardMessage,
  type DashboardReplayCompletedMessage,
  type DashboardRequestReceivedMessage,
  type DashboardResponseCompletedMessage,
  type DashboardStatisticsUpdatedMessage,
  type DashboardTunnelConnectedMessage,
  type DashboardTunnelDisconnectedMessage,
} from "./dashboard-messages.js";

/**
 * Maps a {@link TunnelCreatedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapTunnelCreatedToDashboard(
  event: TunnelCreatedEvent,
): DashboardTunnelConnectedMessage {
  return {
    type: DashboardMessageType.TunnelConnected,
    occurredAt: event.occurredAt,
    tunnelId: event.tunnelId,
    publicUrl: event.publicUrl,
    port: event.port,
    restored: event.restored,
  };
}

/**
 * Maps a {@link TunnelClosedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapTunnelClosedToDashboard(
  event: TunnelClosedEvent,
): DashboardTunnelDisconnectedMessage {
  return {
    type: DashboardMessageType.TunnelDisconnected,
    occurredAt: event.occurredAt,
    tunnelId: event.tunnelId,
    reason: event.reason,
  };
}

/**
 * Maps a {@link RequestReceivedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapRequestReceivedToDashboard(
  event: RequestReceivedEvent,
): DashboardRequestReceivedMessage {
  return {
    type: DashboardMessageType.RequestReceived,
    occurredAt: event.occurredAt,
    requestId: event.requestId,
    tunnelId: event.tunnelId,
    method: event.method,
    path: event.path,
  };
}

/**
 * Maps a {@link ResponseReturnedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapResponseReturnedToDashboard(
  event: ResponseReturnedEvent,
): DashboardResponseCompletedMessage {
  return {
    type: DashboardMessageType.ResponseCompleted,
    occurredAt: event.occurredAt,
    requestId: event.requestId,
    tunnelId: event.tunnelId,
    method: event.method,
    path: event.path,
    statusCode: event.statusCode,
    latencyMs: event.latencyMs,
  };
}

/**
 * Maps a {@link ReplayCompletedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapReplayCompletedToDashboard(
  event: ReplayCompletedEvent,
): DashboardReplayCompletedMessage {
  return {
    type: DashboardMessageType.ReplayCompleted,
    occurredAt: event.occurredAt,
    requestId: event.requestId,
    tunnelId: event.tunnelId,
    method: event.method,
    path: event.path,
    statusCode: event.statusCode,
  };
}

/**
 * Maps a {@link StatisticsUpdatedEvent} to a dashboard broadcast message.
 *
 * @param event - EventBus payload.
 * @returns Dashboard message.
 */
export function mapStatisticsUpdatedToDashboard(
  event: StatisticsUpdatedEvent,
): DashboardStatisticsUpdatedMessage {
  return {
    type: DashboardMessageType.StatisticsUpdated,
    occurredAt: event.occurredAt,
    statistics: event.statistics,
    tunnelId: event.tunnelId,
  };
}

/**
 * Narrows an unknown parsed JSON value to a {@link DashboardMessage}.
 *
 * @param value - Parsed JSON.
 * @returns The message when the `type` field is recognized.
 */
export function parseDashboardMessage(value: unknown): DashboardMessage | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return undefined;
  }

  const type = value.type;
  if (typeof type !== "string") {
    return undefined;
  }

  const known = new Set<string>(Object.values(DashboardMessageType));
  if (!known.has(type)) {
    return undefined;
  }

  return value as DashboardMessage;
}
