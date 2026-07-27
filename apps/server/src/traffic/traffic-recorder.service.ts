import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  BadgerEventType,
  EVENT_BUS,
  type EventBus,
  type EventSubscription,
  type RequestFailedEvent,
  type RequestReceivedEvent,
  type ResponseReturnedEvent,
} from "@hridhin-k/badger-shared";

import { TRAFFIC_RECORD_STORE } from "./traffic.constants.js";
import type { TrafficRecordStore } from "./traffic-record.store.js";
import type { ListTrafficRecordsOptions, TrafficRecord } from "./traffic.types.js";

/**
 * Observes HTTP lifecycle events and persists {@link TrafficRecord} entries.
 *
 * Subscribes only to the EventBus — it never participates in request forwarding.
 */
@Injectable()
export class TrafficRecorderService implements OnModuleInit, OnModuleDestroy {
  private readonly subscriptions: EventSubscription[] = [];

  /**
   * @param eventBus - Shared lifecycle bus.
   * @param store - Traffic persistence port.
   */
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    @Inject(TRAFFIC_RECORD_STORE) private readonly store: TrafficRecordStore,
  ) {}

  /**
   * Subscribes to HTTP lifecycle events.
   */
  onModuleInit(): void {
    this.subscriptions.push(
      this.eventBus.subscribe(BadgerEventType.RequestReceived, (event) => {
        this.onRequestReceived(event);
      }),
      this.eventBus.subscribe(BadgerEventType.ResponseReturned, (event) => {
        this.onResponseReturned(event);
      }),
      this.eventBus.subscribe(BadgerEventType.RequestFailed, (event) => {
        this.onRequestFailed(event);
      }),
    );
  }

  /**
   * Cancels EventBus subscriptions.
   */
  onModuleDestroy(): void {
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
  findById(requestId: string): TrafficRecord | undefined {
    return this.store.findById(requestId);
  }

  /**
   * Lists recorded exchanges, newest first.
   *
   * @param options - Optional limit and tunnel filter.
   * @returns Matching records.
   */
  list(options?: ListTrafficRecordsOptions): readonly TrafficRecord[] {
    return this.store.list(options);
  }

  /**
   * @returns Number of retained records.
   */
  size(): number {
    return this.store.size();
  }

  /**
   * Drops every retained record. Intended for tests.
   */
  clear(): void {
    this.store.clear();
  }

  private onRequestReceived(event: RequestReceivedEvent): void {
    this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt,
      method: event.method,
      path: event.path,
      headers: event.headers,
      body: event.body,
      status: undefined,
      responseHeaders: {},
      responseBody: new Uint8Array(),
      latencyMs: undefined,
      tunnelId: event.tunnelId,
      error: undefined,
    });
  }

  private onResponseReturned(event: ResponseReturnedEvent): void {
    const updated = this.store.update(event.requestId, {
      status: event.statusCode,
      responseHeaders: event.responseHeaders,
      responseBody: event.responseBody,
      latencyMs: event.latencyMs,
    });

    if (updated !== undefined) {
      return;
    }

    // Response observed without a prior RequestReceived (should be rare).
    this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt - event.latencyMs,
      method: event.method,
      path: event.path,
      headers: {},
      body: new Uint8Array(),
      status: event.statusCode,
      responseHeaders: event.responseHeaders,
      responseBody: event.responseBody,
      latencyMs: event.latencyMs,
      tunnelId: event.tunnelId,
      error: undefined,
    });
  }

  private onRequestFailed(event: RequestFailedEvent): void {
    if (event.requestId === undefined) {
      return;
    }

    const updated = this.store.update(event.requestId, {
      error: event.error,
    });

    if (updated !== undefined) {
      return;
    }

    this.store.save({
      requestId: event.requestId,
      timestamp: event.occurredAt,
      method: event.method,
      path: event.path,
      headers: {},
      body: new Uint8Array(),
      status: undefined,
      responseHeaders: {},
      responseBody: new Uint8Array(),
      latencyMs: undefined,
      tunnelId: event.tunnelId,
      error: event.error,
    });
  }
}
