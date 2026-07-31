import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BadgerEventType,
  DEFAULT_MAX_RECORDED_BODY_BYTES,
  EVENT_BUS,
  MessageType,
  createEventPayload,
  createTrafficBody,
  type EventBus,
  type HttpCookies,
  type HttpHeaders,
  type HttpMethod,
  type HttpQuery,
  type ProtocolMessage,
  type TrafficBody,
} from "@hridhin-k/badger-shared";
import WebSocket from "ws";

import type { TunnelRecord } from "../tunnel/tunnel.types.js";
import { encodeBodyChunk, splitBytes } from "./body-codec.js";
import { HttpExchangeCoordinator } from "./http-exchange.coordinator.js";

/** Default timeout for a full HTTP forward exchange. */
export const DEFAULT_HTTP_FORWARD_TIMEOUT_MS = 30_000;

/**
 * An HTTP request to forward through a tunnel WebSocket to the CLI.
 */
export interface ForwardHttpRequest {
  /** Target tunnel session. */
  readonly tunnel: TunnelRecord;
  /** HTTP method. */
  readonly method: HttpMethod;
  /** URL pathname. */
  readonly path: string;
  /** Query parameters. */
  readonly query: HttpQuery;
  /** Request headers excluding Cookie. */
  readonly headers: HttpHeaders;
  /** Parsed cookies. */
  readonly cookies: HttpCookies;
  /** Optional raw request body. */
  readonly body?: Uint8Array;
  /** Optional abort signal. */
  readonly signal?: AbortSignal;
}

/**
 * A forwarded HTTP response assembled from CLI protocol frames.
 */
export interface ForwardHttpResponse {
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** HTTP status code. */
  readonly statusCode: number;
  /** Response headers excluding Set-Cookie. */
  readonly headers: HttpHeaders;
  /** Raw Set-Cookie values. */
  readonly setCookies: readonly string[];
  /** Streaming response body. */
  readonly body: AsyncIterable<Uint8Array>;
}

/**
 * Forwards public HTTP requests to a tunnel client over the Badger protocol.
 *
 * After frames are sent / responses complete, publishes lifecycle events on the
 * shared {@link EventBus} (fire-and-forget). Forwarding control flow is unchanged.
 */
@Injectable()
export class HttpForwardingService {
  private readonly logger = new Logger(HttpForwardingService.name);
  private readonly timeoutMs: number;

  /**
   * @param coordinator - Correlates CLI response frames with in-flight requests.
   * @param eventBus - Process-wide lifecycle bus (TrafficRecorder / Dashboard).
   */
  constructor(
    private readonly coordinator: HttpExchangeCoordinator,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.timeoutMs = resolveHttpForwardTimeoutMs();
  }

  /**
   * Sends an HTTP request to the tunnel client and awaits the streamed response.
   *
   * @param request - Tunnel target and HTTP request fields.
   * @returns Status, headers, cookies, and streaming body from the CLI.
   */
  async forward(request: ForwardHttpRequest): Promise<ForwardHttpResponse> {
    const { tunnel } = request;

    if (tunnel.client.readyState !== WebSocket.OPEN) {
      this.publishRequestFailed({
        tunnelId: tunnel.id,
        ...(tunnel.workspaceId === undefined ? {} : { workspaceId: tunnel.workspaceId }),
        requestId: undefined,
        method: request.method,
        path: request.path,
        error: "Tunnel WebSocket is not open.",
      });
      throw new Error("Tunnel WebSocket is not open.");
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    const exchange = this.coordinator.begin(requestId);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal =
      request.signal === undefined ? timeout : AbortSignal.any([request.signal, timeout]);

    const onAbort = (): void => {
      try {
        this.send(tunnel.client, {
          type: MessageType.HttpCancel,
          requestId,
          tunnelId: tunnel.id,
          reason: "HTTP forward aborted or timed out.",
        });
      } catch {
        // Best-effort cancel notification.
      }
      exchange.fail(new Error("HTTP forward timed out or was aborted."));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    try {
      this.sendRequestFrames(tunnel, requestId, request);
      this.publishRequestLifecycle(request, requestId);

      const start = await exchange.waitForStart();

      return {
        requestId,
        statusCode: start.statusCode,
        headers: start.headers,
        setCookies: start.setCookies,
        body: this.observeBody(exchange.body, start.hasBody, {
          tunnelId: tunnel.id,
          ...(tunnel.workspaceId === undefined ? {} : { workspaceId: tunnel.workspaceId }),
          requestId,
          method: request.method,
          path: request.path,
          statusCode: start.statusCode,
          responseHeaders: start.headers,
          startedAt,
        }),
      };
    } catch (error: unknown) {
      this.coordinator.complete(requestId);
      const message = error instanceof Error ? error.message : String(error);
      this.publishRequestFailed({
        tunnelId: tunnel.id,
        ...(tunnel.workspaceId === undefined ? {} : { workspaceId: tunnel.workspaceId }),
        requestId,
        method: request.method,
        path: request.path,
        error: message,
      });
      throw error;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  private sendRequestFrames(
    tunnel: TunnelRecord,
    requestId: string,
    request: ForwardHttpRequest,
  ): void {
    const body = request.body;
    const hasBody = body !== undefined && body.byteLength > 0;

    this.send(tunnel.client, {
      type: MessageType.HttpRequestStart,
      requestId,
      tunnelId: tunnel.id,
      method: request.method,
      path: request.path,
      query: request.query,
      headers: request.headers,
      cookies: request.cookies,
      hasBody,
    });

    if (body !== undefined && body.byteLength > 0) {
      let sequence = 0;
      for (const chunk of splitBytes(body)) {
        const encoded = encodeBodyChunk(chunk);
        this.send(tunnel.client, {
          type: MessageType.HttpRequestChunk,
          requestId,
          tunnelId: tunnel.id,
          sequence,
          encoding: encoded.encoding,
          data: encoded.data,
        });
        sequence += 1;
      }
    }

    this.send(tunnel.client, {
      type: MessageType.HttpRequestEnd,
      requestId,
      tunnelId: tunnel.id,
    });

    this.logger.debug(
      `Forwarded ${request.method} ${request.path} to tunnel ${tunnel.id} (${requestId})`,
    );
  }

  private async *observeBody(
    body: AsyncIterable<Uint8Array>,
    hasBody: boolean,
    meta: {
      readonly tunnelId: string;
      readonly workspaceId?: string;
      readonly requestId: string;
      readonly method: HttpMethod;
      readonly path: string;
      readonly statusCode: number;
      readonly responseHeaders: HttpHeaders;
      readonly startedAt: number;
    },
  ): AsyncIterable<Uint8Array> {
    const retained: Uint8Array[] = [];
    let retainedBytes = 0;
    let totalBytes = 0;

    try {
      for await (const chunk of body) {
        totalBytes += chunk.byteLength;
        if (retainedBytes < DEFAULT_MAX_RECORDED_BODY_BYTES) {
          const room = DEFAULT_MAX_RECORDED_BODY_BYTES - retainedBytes;
          const take = chunk.byteLength <= room ? chunk : chunk.subarray(0, room);
          retained.push(take);
          retainedBytes += take.byteLength;
        }

        if (hasBody) {
          yield chunk;
        }
      }

      this.publishResponseReturned({
        ...meta,
        responseBody: toRecordedBody(retained, totalBytes),
        latencyMs: Math.max(0, Date.now() - meta.startedAt),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.publishRequestFailed({
        tunnelId: meta.tunnelId,
        ...(meta.workspaceId === undefined ? {} : { workspaceId: meta.workspaceId }),
        requestId: meta.requestId,
        method: meta.method,
        path: meta.path,
        error: message,
      });
      throw error;
    }
  }

  private publishRequestLifecycle(request: ForwardHttpRequest, requestId: string): void {
    const correlation = { correlationId: requestId } as const;

    this.eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: request.tunnel.id,
        ...(request.tunnel.workspaceId === undefined
          ? {}
          : { workspaceId: request.tunnel.workspaceId }),
        requestId,
        method: request.method,
        path: request.path,
        headers: request.headers,
        query: request.query,
        body: createTrafficBody(request.body),
        ...correlation,
      }),
    );

    this.eventBus.publish(
      BadgerEventType.RequestForwarded,
      createEventPayload({
        tunnelId: request.tunnel.id,
        ...(request.tunnel.workspaceId === undefined
          ? {}
          : { workspaceId: request.tunnel.workspaceId }),
        requestId,
        method: request.method,
        path: request.path,
        ...correlation,
      }),
    );
  }

  private publishResponseReturned(input: {
    readonly tunnelId: string;
    readonly workspaceId?: string;
    readonly requestId: string;
    readonly method: HttpMethod;
    readonly path: string;
    readonly statusCode: number;
    readonly responseHeaders: HttpHeaders;
    readonly responseBody: TrafficBody;
    readonly latencyMs: number;
  }): void {
    this.eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: input.tunnelId,
        ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
        requestId: input.requestId,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        responseHeaders: input.responseHeaders,
        responseBody: input.responseBody,
        latencyMs: input.latencyMs,
        correlationId: input.requestId,
      }),
    );
  }

  private publishRequestFailed(input: {
    readonly tunnelId: string;
    readonly workspaceId?: string;
    readonly requestId: string | undefined;
    readonly method: HttpMethod;
    readonly path: string;
    readonly error: string;
  }): void {
    this.eventBus.publish(
      BadgerEventType.RequestFailed,
      createEventPayload({
        tunnelId: input.tunnelId,
        ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
        requestId: input.requestId,
        method: input.method,
        path: input.path,
        error: input.error,
        ...(input.requestId === undefined ? {} : { correlationId: input.requestId }),
      }),
    );
  }

  private send(client: WebSocket, message: ProtocolMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send protocol message: WebSocket is not open.");
    }

    client.send(JSON.stringify(message));
  }
}

/**
 * Builds a {@link TrafficBody} from retained chunks plus the original byte count.
 *
 * @param retained - Bytes kept for recording (already capped).
 * @param totalBytes - Full response size before truncation.
 * @returns Snapshot suitable for EventBus publish.
 */
function toRecordedBody(retained: readonly Uint8Array[], totalBytes: number): TrafficBody {
  if (totalBytes === 0) {
    return createTrafficBody(undefined);
  }

  const data = Buffer.concat(retained.map((chunk) => Buffer.from(chunk)));
  return {
    byteLength: totalBytes,
    truncated: totalBytes > data.byteLength,
    dataBase64: data.toString("base64"),
  };
}

/**
 * Resolves the HTTP forward timeout from the environment.
 *
 * @returns Timeout in milliseconds.
 */
export function resolveHttpForwardTimeoutMs(): number {
  const raw = process.env["BADGER_HTTP_FORWARD_TIMEOUT_MS"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_HTTP_FORWARD_TIMEOUT_MS;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `Invalid BADGER_HTTP_FORWARD_TIMEOUT_MS "${raw}": expected a positive integer.`,
    );
  }

  return value;
}
