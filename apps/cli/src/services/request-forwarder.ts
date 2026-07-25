import {
  MessageType,
  type HttpCancelMessage,
  type HttpForwardingMessage,
  type HttpRequestChunkMessage,
  type HttpRequestEndMessage,
  type HttpRequestStartMessage,
  type ProtocolMessage,
} from "@looplink/shared";

import type { LocalProxy, LocalProxyResponse } from "./local-proxy.js";
import { concatChunks, decodeBodyChunk, encodeBodyChunk, splitBytes } from "../utils/body-codec.js";

/**
 * HTTP forwarding frames the server sends to the CLI.
 */
export type InboundForwardingMessage =
  HttpRequestStartMessage | HttpRequestChunkMessage | HttpRequestEndMessage | HttpCancelMessage;

/**
 * Sends a protocol message back to the LoopLink server.
 */
export type SendMessage = (message: ProtocolMessage) => void;

interface PendingExchange {
  readonly start: HttpRequestStartMessage;
  readonly chunks: Uint8Array[];
  readonly abort: AbortController;
}

/**
 * Serves forwarded HTTP requests against the local target.
 *
 * The server streams `http_request_*` frames for each public request. This
 * service reassembles the request, executes it through {@link LocalProxy}, and
 * streams `http_response_*` frames back. Failures reaching the local target are
 * reported as protocol errors so the server can answer with a 502 instead of
 * waiting for its exchange timeout.
 */
export class RequestForwarder {
  private readonly pending = new Map<string, PendingExchange>();
  private readonly inFlight = new Map<string, AbortController>();

  /**
   * @param port - Local TCP port that receives forwarded requests.
   * @param proxy - HTTP client targeting localhost.
   * @param send - Callback that writes protocol messages to the server.
   */
  constructor(
    private readonly port: number,
    private readonly proxy: LocalProxy,
    private readonly send: SendMessage,
  ) {}

  /**
   * Routes one inbound HTTP forwarding frame.
   *
   * Response-plane frames are ignored: the server never sends them to the CLI.
   *
   * @param message - Parsed HTTP forwarding message from the server.
   */
  handle(message: HttpForwardingMessage): void {
    switch (message.type) {
      case MessageType.HttpRequestStart:
        this.onStart(message);
        return;
      case MessageType.HttpRequestChunk:
        this.onChunk(message);
        return;
      case MessageType.HttpRequestEnd:
        this.onEnd(message);
        return;
      case MessageType.HttpCancel:
        this.onCancel(message);
        return;
      default:
        return;
    }
  }

  private onStart(message: HttpRequestStartMessage): void {
    this.pending.set(message.requestId, {
      start: message,
      chunks: [],
      abort: new AbortController(),
    });
  }

  private onChunk(message: HttpRequestChunkMessage): void {
    const exchange = this.pending.get(message.requestId);

    if (exchange === undefined) {
      return;
    }

    exchange.chunks.push(decodeBodyChunk(message.encoding, message.data));
  }

  private onEnd(message: HttpRequestEndMessage): void {
    const exchange = this.pending.get(message.requestId);

    if (exchange === undefined) {
      return;
    }

    this.pending.delete(message.requestId);
    void this.respond(message.requestId, exchange);
  }

  private onCancel(message: HttpCancelMessage): void {
    const buffered = this.pending.get(message.requestId);

    if (buffered !== undefined) {
      this.pending.delete(message.requestId);
      buffered.abort.abort();
      return;
    }

    this.inFlight.get(message.requestId)?.abort();
  }

  private async respond(requestId: string, exchange: PendingExchange): Promise<void> {
    const { start, abort } = exchange;
    this.inFlight.set(requestId, abort);

    try {
      const body = concatChunks(exchange.chunks);
      const response = await this.proxy.forward(this.port, {
        method: start.method,
        path: start.path,
        query: start.query,
        headers: start.headers,
        cookies: start.cookies,
        ...(body === undefined ? {} : { body }),
        signal: abort.signal,
      });

      await this.streamResponse(start.tunnelId, requestId, response, abort.signal);
    } catch (error: unknown) {
      if (!abort.signal.aborted) {
        this.sendError(requestId, error);
      }
    } finally {
      this.inFlight.delete(requestId);
    }
  }

  private async streamResponse(
    tunnelId: string,
    requestId: string,
    response: LocalProxyResponse,
    signal: AbortSignal,
  ): Promise<void> {
    // Peek the first chunk so `hasBody` is accurate in the start frame.
    const iterator = response.body[Symbol.asyncIterator]();
    let current = await iterator.next();

    this.send({
      type: MessageType.HttpResponseStart,
      requestId,
      tunnelId,
      statusCode: response.statusCode,
      headers: response.headers,
      setCookies: [...response.setCookies],
      hasBody: current.done !== true,
    });

    let sequence = 0;

    while (current.done !== true) {
      if (signal.aborted) {
        return;
      }

      for (const piece of splitBytes(current.value)) {
        const encoded = encodeBodyChunk(piece);
        this.send({
          type: MessageType.HttpResponseChunk,
          requestId,
          tunnelId,
          sequence,
          encoding: encoded.encoding,
          data: encoded.data,
        });
        sequence += 1;
      }

      current = await iterator.next();
    }

    this.send({
      type: MessageType.HttpResponseEnd,
      requestId,
      tunnelId,
    });
  }

  private sendError(requestId: string, error: unknown): void {
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Local request failed.";

    try {
      this.send({
        type: MessageType.Error,
        requestId,
        code: "local_forward_failed",
        message: `Could not reach the local target on port ${String(this.port)}: ${reason}`,
      });
    } catch {
      // The connection dropped mid-exchange; the server times the request out.
    }
  }
}
