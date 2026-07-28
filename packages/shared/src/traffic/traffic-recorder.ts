import {
  BadgerEventType,
  type EventBus,
  type EventSubscription,
  type RequestFailedEvent,
  type RequestReceivedEvent,
  type ResponseReturnedEvent,
} from "../event-bus/index.js";
import { EMPTY_TRAFFIC_BODY } from "./traffic-body.js";
import type { TrafficRecordStore } from "./traffic-record-store.js";
import type { ListTrafficRecordsOptions, TrafficRecord } from "./traffic-record.js";

/**
 * Observes HTTP lifecycle events and persists {@link TrafficRecord} entries.
 *
 * Framework-free: Nest (or any host) constructs this with an injected
 * {@link EventBus} and {@link TrafficRecordStore}. It never participates in
 * request forwarding.
 *
 * Handlers for the same `requestId` are serialized so RequestReceived /
 * ResponseReturned / RequestFailed cannot race on the store.
 */
export class TrafficRecorder {
  private readonly subscriptions: EventSubscription[] = [];
  /**
   * Per-request async chain so lifecycle events for one exchange run in order.
   */
  private readonly chains = new Map<string, Promise<void>>();

  /**
   * @param eventBus - Shared lifecycle bus.
   * @param store - Traffic persistence port (backed by StorageProvider).
   */
  constructor(
    private readonly eventBus: EventBus,
    private readonly store: TrafficRecordStore,
  ) {}

  /**
   * Subscribes to HTTP lifecycle events. Idempotent when already started.
   */
  start(): void {
    if (this.subscriptions.length > 0) {
      return;
    }

    this.subscriptions.push(
      this.eventBus.subscribe(BadgerEventType.RequestReceived, (event) => {
        this.enqueue(event.requestId, () => this.onRequestReceived(event));
      }),
      this.eventBus.subscribe(BadgerEventType.ResponseReturned, (event) => {
        this.enqueue(event.requestId, () => this.onResponseReturned(event));
      }),
      this.eventBus.subscribe(BadgerEventType.RequestFailed, (event) => {
        if (event.requestId === undefined) {
          return;
        }
        this.enqueue(event.requestId, () => this.onRequestFailed(event));
      }),
    );
  }

  /**
   * Cancels EventBus subscriptions. Idempotent.
   */
  stop(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;
  }

  /**
   * Looks up a recorded exchange by request id.
   *
   * @param requestId - Correlation id from the EventBus payload.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(requestId: string): Promise<TrafficRecord | undefined> {
    return this.store.findById(requestId);
  }

  /**
   * Lists recorded exchanges, newest first.
   *
   * @param options - Optional limit, tunnel filter, and body inclusion.
   * @returns Matching records.
   */
  list(options?: ListTrafficRecordsOptions): Promise<readonly TrafficRecord[]> {
    return this.store.list(options);
  }

  /**
   * @returns Number of retained records.
   */
  size(): Promise<number> {
    return this.store.size();
  }

  /**
   * Drops every retained record. Intended for tests.
   */
  clear(): Promise<void> {
    return this.store.clear();
  }

  /**
   * Waits until all queued work for `requestId` (or every request) settles.
   *
   * Intended for tests.
   *
   * @param requestId - When set, only that request's chain is awaited.
   */
  async flush(requestId?: string): Promise<void> {
    if (requestId !== undefined) {
      await (this.chains.get(requestId) ?? Promise.resolve());
      return;
    }

    await Promise.all([...this.chains.values()]);
  }

  private enqueue(requestId: string, task: () => Promise<void>): void {
    const previous = this.chains.get(requestId) ?? Promise.resolve();
    const next = previous
      .catch(() => {
        // Prior task failures must not block later lifecycle events.
      })
      .then(task);

    this.chains.set(requestId, next);

    void next.finally(() => {
      if (this.chains.get(requestId) === next) {
        this.chains.delete(requestId);
      }
    });
  }

  private async onRequestReceived(event: RequestReceivedEvent): Promise<void> {
    await this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt,
      method: event.method,
      path: event.path,
      headers: event.headers,
      query: event.query,
      body: event.body,
      status: undefined,
      responseHeaders: {},
      responseBody: EMPTY_TRAFFIC_BODY,
      latencyMs: undefined,
      tunnelId: event.tunnelId,
      error: undefined,
    });
  }

  private async onResponseReturned(event: ResponseReturnedEvent): Promise<void> {
    const updated = await this.store.update(event.requestId, {
      status: event.statusCode,
      responseHeaders: event.responseHeaders,
      responseBody: event.responseBody,
      latencyMs: event.latencyMs,
    });

    if (updated !== undefined) {
      return;
    }

    // Response observed without a prior RequestReceived (should be rare).
    await this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt - event.latencyMs,
      method: event.method,
      path: event.path,
      headers: {},
      query: {},
      body: EMPTY_TRAFFIC_BODY,
      status: event.statusCode,
      responseHeaders: event.responseHeaders,
      responseBody: event.responseBody,
      latencyMs: event.latencyMs,
      tunnelId: event.tunnelId,
      error: undefined,
    });
  }

  private async onRequestFailed(event: RequestFailedEvent): Promise<void> {
    if (event.requestId === undefined) {
      return;
    }

    const updated = await this.store.update(event.requestId, {
      error: event.error,
    });

    if (updated !== undefined) {
      return;
    }

    await this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt,
      method: event.method,
      path: event.path,
      headers: {},
      query: {},
      body: EMPTY_TRAFFIC_BODY,
      status: undefined,
      responseHeaders: {},
      responseBody: EMPTY_TRAFFIC_BODY,
      latencyMs: undefined,
      tunnelId: event.tunnelId,
      error: event.error,
    });
  }
}
