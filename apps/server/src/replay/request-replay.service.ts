import { Inject, Injectable } from "@nestjs/common";
import {
  BadgerEventType,
  EVENT_BUS,
  ReplayError,
  ReplayErrorCode,
  TRAFFIC_RECORD_STORE,
  createEventPayload,
  createTrafficBody,
  mapTrafficRecordToForwardRequest,
  type EventBus,
  type ReplayResult,
  type TrafficRecordStore,
} from "@hridhin-k/badger-shared";

import { HttpForwardingService } from "../http-forward/http-forwarding.service.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";

/**
 * Replays a previously recorded HTTP exchange through
 * {@link HttpForwardingService} — no duplicated forward logic.
 */
@Injectable()
export class RequestReplayService {
  /**
   * @param store - Recorded traffic.
   * @param tunnelManager - Active tunnel lookup.
   * @param forwarding - Existing HTTP forward pipeline.
   * @param eventBus - Lifecycle bus (publishes ReplayCompleted).
   */
  constructor(
    @Inject(TRAFFIC_RECORD_STORE) private readonly store: TrafficRecordStore,
    private readonly tunnelManager: TunnelManager,
    private readonly forwarding: HttpForwardingService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * Loads `requestId` from the traffic store and forwards it on the original tunnel.
   *
   * @param requestId - Traffic record id.
   * @returns Status, headers, and body from the live local app.
   * @throws ReplayError When the record/tunnel is missing or forward fails.
   */
  async replay(requestId: string, workspaceId?: string): Promise<ReplayResult> {
    const record = await this.store.findById(requestId);
    if (record === undefined) {
      throw new ReplayError(
        ReplayErrorCode.NotFound,
        `No traffic record found for request id "${requestId}".`,
      );
    }
    if (workspaceId !== undefined && record.workspaceId !== workspaceId) {
      throw new ReplayError(
        ReplayErrorCode.NotFound,
        `No traffic record found for request id "${requestId}" in workspace "${workspaceId}".`,
      );
    }

    const tunnel = this.tunnelManager.lookup(record.tunnelId);
    if (tunnel === undefined) {
      throw new ReplayError(
        ReplayErrorCode.TunnelUnavailable,
        `Tunnel "${record.tunnelId}" is not connected; start the CLI tunnel before replaying.`,
      );
    }

    const forwardRequest = mapTrafficRecordToForwardRequest(record);

    try {
      const response = await this.forwarding.forward({
        tunnel,
        method: forwardRequest.method,
        path: forwardRequest.path,
        query: forwardRequest.query,
        headers: forwardRequest.headers,
        cookies: forwardRequest.cookies,
        ...(forwardRequest.body === undefined ? {} : { body: forwardRequest.body }),
      });

      const bodyBytes = await collectBody(response.body);

      const result: ReplayResult = {
        originalRequestId: record.requestId,
        tunnelId: record.tunnelId,
        method: forwardRequest.method,
        path: forwardRequest.path,
        statusCode: response.statusCode,
        headers: response.headers,
        setCookies: response.setCookies,
        body: createTrafficBody(bodyBytes),
        requestBodyTruncated: forwardRequest.requestBodyTruncated,
      };

      this.eventBus.publish(
        BadgerEventType.ReplayCompleted,
        createEventPayload({
          requestId: result.originalRequestId,
          tunnelId: result.tunnelId,
          method: result.method,
          path: result.path,
          statusCode: result.statusCode,
          ...(record.workspaceId === undefined ? {} : { workspaceId: record.workspaceId }),
          correlationId: result.originalRequestId,
        }),
      );

      return result;
    } catch (error: unknown) {
      if (error instanceof ReplayError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new ReplayError(ReplayErrorCode.ForwardFailed, message);
    }
  }
}

/**
 * Collects a streamed body into a single byte array.
 *
 * @param body - Async iterable chunks.
 * @returns Concatenated bytes.
 */
async function collectBody(body: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of body) {
    chunks.push(chunk);
    total += chunk.byteLength;
  }

  if (chunks.length === 0) {
    return new Uint8Array();
  }

  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}
