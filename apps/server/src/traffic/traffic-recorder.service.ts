import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import {
  EVENT_BUS,
  TRAFFIC_RECORD_STORE,
  TrafficRecorder,
  type EventBus,
  type ListTrafficRecordsOptions,
  type TrafficRecord,
  type TrafficRecordStore,
} from "@hridhin-k/badger-shared";

/**
 * Nest adapter that starts {@link TrafficRecorder} on module init.
 *
 * Subscribes only to the EventBus — it never participates in request forwarding.
 */
@Injectable()
export class TrafficRecorderService implements OnModuleInit, OnModuleDestroy {
  private readonly recorder: TrafficRecorder;

  /**
   * @param eventBus - Shared lifecycle bus.
   * @param store - Traffic persistence port.
   */
  constructor(
    @Inject(EVENT_BUS) eventBus: EventBus,
    @Inject(TRAFFIC_RECORD_STORE) store: TrafficRecordStore,
  ) {
    this.recorder = new TrafficRecorder(eventBus, store);
  }

  /**
   * Subscribes to HTTP lifecycle events.
   */
  onModuleInit(): void {
    this.recorder.start();
  }

  /**
   * Cancels EventBus subscriptions.
   */
  onModuleDestroy(): void {
    this.recorder.stop();
  }

  /**
   * Looks up a recorded exchange by request id.
   *
   * @param requestId - Correlation id from the EventBus payload.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(requestId: string): Promise<TrafficRecord | undefined> {
    return this.recorder.findById(requestId);
  }

  /**
   * Lists recorded exchanges, newest first.
   *
   * @param options - Optional limit, tunnel filter, and body inclusion.
   * @returns Matching records.
   */
  list(options?: ListTrafficRecordsOptions): Promise<readonly TrafficRecord[]> {
    return this.recorder.list(options);
  }

  /**
   * @returns Number of retained records.
   */
  size(): Promise<number> {
    return this.recorder.size();
  }

  /**
   * Drops every retained record. Intended for tests.
   */
  clear(): Promise<void> {
    return this.recorder.clear();
  }

  /**
   * Waits until queued EventBus work settles. Intended for tests.
   *
   * @param requestId - When set, only that request's chain is awaited.
   */
  flush(requestId?: string): Promise<void> {
    return this.recorder.flush(requestId);
  }
}
