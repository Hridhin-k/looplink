import { Injectable } from "@nestjs/common";
import {
  MAX_EXCHANGE_BUFFER_BYTES,
  MAX_PENDING_HTTP_EXCHANGES,
  MessageType,
  type ErrorMessage,
  type HttpCancelMessage,
  type HttpForwardingMessage,
  type HttpResponseChunkMessage,
  type HttpResponseStartMessage,
} from "@badger/shared";

/**
 * A pending HTTP exchange waiting for CLI response frames.
 */
export interface PendingHttpExchange {
  /** Correlation id for this exchange. */
  readonly requestId: string;
  /** Resolves when {@link HttpResponseStartMessage} arrives. */
  readonly waitForStart: () => Promise<HttpResponseStartMessage>;
  /** Async iterator of decoded response body chunks; ends after response end. */
  readonly body: AsyncIterable<Uint8Array>;
  /** Fails the exchange locally (timeout / abort). */
  readonly fail: (error: Error) => void;
}

interface InternalPending {
  readonly requestId: string;
  startResolve: ((message: HttpResponseStartMessage) => void) | undefined;
  startReject: ((error: Error) => void) | undefined;
  startPromise: Promise<HttpResponseStartMessage>;
  readonly chunkWaiters: ((result: IteratorResult<Uint8Array>) => void)[];
  readonly chunkBuffer: Uint8Array[];
  bufferedBytes: number;
  bodyEnded: boolean;
  failed: Error | undefined;
}

/**
 * Correlates in-flight HTTP forwards with WebSocket response frames from the CLI.
 *
 * Caps concurrent exchanges and per-exchange buffered body bytes so a slow
 * public consumer or hostile CLI cannot exhaust memory.
 */
@Injectable()
export class HttpExchangeCoordinator {
  private readonly pending = new Map<string, InternalPending>();
  private readonly maxPending: number;
  private readonly maxBufferBytes: number;

  /**
   * @param maxPending - Ceiling on concurrent in-flight exchanges.
   * @param maxBufferBytes - Ceiling on buffered response bytes per exchange.
   */
  constructor(
    maxPending: number = MAX_PENDING_HTTP_EXCHANGES,
    maxBufferBytes: number = MAX_EXCHANGE_BUFFER_BYTES,
  ) {
    this.maxPending = maxPending;
    this.maxBufferBytes = maxBufferBytes;
  }

  /**
   * Registers a new exchange that will receive response frames for `requestId`.
   *
   * @param requestId - Correlation id shared with the CLI.
   * @returns Handles used by the forwarding service to await the response.
   * @throws Error When the concurrent exchange limit is reached.
   */
  begin(requestId: string): PendingHttpExchange {
    if (this.pending.has(requestId)) {
      throw new Error(`HTTP exchange already pending for requestId ${requestId}`);
    }

    if (this.pending.size >= this.maxPending) {
      throw new Error(`Too many in-flight HTTP exchanges (limit ${String(this.maxPending)}).`);
    }

    let startResolve: ((message: HttpResponseStartMessage) => void) | undefined;
    let startReject: ((error: Error) => void) | undefined;

    const startPromise = new Promise<HttpResponseStartMessage>((resolve, reject) => {
      startResolve = resolve;
      startReject = reject;
    });

    const entry: InternalPending = {
      requestId,
      startResolve,
      startReject,
      startPromise,
      chunkWaiters: [],
      chunkBuffer: [],
      bufferedBytes: 0,
      bodyEnded: false,
      failed: undefined,
    };

    this.pending.set(requestId, entry);

    return {
      requestId,
      waitForStart: () => entry.startPromise,
      body: this.iterateBody(entry),
      fail: (error) => {
        this.failExchange(entry, error);
      },
    };
  }

  /**
   * Delivers an inbound CLI protocol message to a pending exchange.
   *
   * @param message - HTTP response/cancel frame or correlated error.
   * @returns `true` when a pending exchange consumed the message.
   */
  deliver(message: HttpForwardingMessage | ErrorMessage): boolean {
    if (message.type === MessageType.Error) {
      if (message.requestId === undefined) {
        return false;
      }

      const entry = this.pending.get(message.requestId);
      if (entry === undefined) {
        return false;
      }

      this.failExchange(entry, new Error(message.message));
      return true;
    }

    const entry = this.pending.get(message.requestId);
    if (entry === undefined) {
      return false;
    }

    switch (message.type) {
      case MessageType.HttpResponseStart:
        this.onResponseStart(entry, message);
        return true;
      case MessageType.HttpResponseChunk:
        this.onResponseChunk(entry, message);
        return true;
      case MessageType.HttpResponseEnd:
        this.onResponseEnd(entry);
        return true;
      case MessageType.HttpCancel:
        this.onCancel(entry, message);
        return true;
      default:
        return false;
    }
  }

  /**
   * Removes a pending exchange without failing waiters (caller already settled).
   *
   * @param requestId - Correlation id to clear.
   */
  complete(requestId: string): void {
    this.pending.delete(requestId);
  }

  private onResponseStart(entry: InternalPending, message: HttpResponseStartMessage): void {
    if (entry.startResolve === undefined) {
      this.failExchange(entry, new Error("Duplicate HttpResponseStart for exchange."));
      return;
    }

    const resolve = entry.startResolve;
    entry.startResolve = undefined;
    entry.startReject = undefined;
    resolve(message);
  }

  private onResponseChunk(entry: InternalPending, message: HttpResponseChunkMessage): void {
    if (entry.bodyEnded || entry.failed !== undefined) {
      return;
    }

    const bytes = Buffer.from(message.data, message.encoding === "utf8" ? "utf8" : "base64");
    this.pushChunk(entry, bytes);
  }

  private onResponseEnd(entry: InternalPending): void {
    if (entry.bodyEnded) {
      return;
    }

    entry.bodyEnded = true;

    while (entry.chunkWaiters.length > 0) {
      const waiter = entry.chunkWaiters.shift();
      waiter?.({ done: true, value: undefined });
    }

    this.pending.delete(entry.requestId);
  }

  private onCancel(entry: InternalPending, message: HttpCancelMessage): void {
    const reason = message.reason ?? "HTTP exchange cancelled by peer.";
    this.failExchange(entry, new Error(reason));
  }

  private failExchange(entry: InternalPending, error: Error): void {
    if (entry.failed !== undefined) {
      return;
    }

    entry.failed = error;
    entry.bodyEnded = true;

    if (entry.startReject !== undefined) {
      entry.startReject(error);
      entry.startResolve = undefined;
      entry.startReject = undefined;
    }

    while (entry.chunkWaiters.length > 0) {
      const waiter = entry.chunkWaiters.shift();
      waiter?.({ done: true, value: undefined });
    }

    this.pending.delete(entry.requestId);
  }

  private pushChunk(entry: InternalPending, chunk: Uint8Array): void {
    const waiter = entry.chunkWaiters.shift();
    if (waiter !== undefined) {
      waiter({ done: false, value: chunk });
      return;
    }

    if (entry.bufferedBytes + chunk.byteLength > this.maxBufferBytes) {
      this.failExchange(
        entry,
        new Error(`HTTP exchange buffer exceeded ${String(this.maxBufferBytes)} bytes.`),
      );
      return;
    }

    entry.chunkBuffer.push(chunk);
    entry.bufferedBytes += chunk.byteLength;
  }

  private async *iterateBody(entry: InternalPending): AsyncIterable<Uint8Array> {
    for (;;) {
      const failure = entry.failed;
      if (failure !== undefined) {
        throw failure;
      }

      const buffered = entry.chunkBuffer.shift();
      if (buffered !== undefined) {
        entry.bufferedBytes = Math.max(0, entry.bufferedBytes - buffered.byteLength);
        yield buffered;
        continue;
      }

      if (entry.bodyEnded) {
        return;
      }

      const next = await new Promise<IteratorResult<Uint8Array>>((resolve) => {
        entry.chunkWaiters.push(resolve);
      });

      const failureAfterWait = entry.failed;
      if (failureAfterWait !== undefined) {
        throw failureAfterWait;
      }

      if (next.done === true) {
        return;
      }

      yield next.value;
    }
  }
}
