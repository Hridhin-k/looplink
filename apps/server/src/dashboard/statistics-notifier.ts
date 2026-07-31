import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import {
  BadgerEventType,
  EVENT_BUS,
  createEventPayload,
  type EventBus,
  type EventSubscription,
  type TrafficStatistics,
} from "@hridhin-k/badger-shared";

import { StatisticsService } from "../statistics/statistics.service.js";

/**
 * Publishes {@link BadgerEventType.StatisticsUpdated} whenever traffic-related
 * lifecycle events occur so {@link import("./dashboard.gateway.js").DashboardGateway}
 * can fan out without calling statistics itself.
 */
@Injectable()
export class StatisticsNotifier implements OnModuleInit, OnModuleDestroy {
  private readonly subscriptions: EventSubscription[] = [];
  private chain: Promise<void> = Promise.resolve();

  /**
   * @param eventBus - Shared lifecycle bus.
   * @param statistics - Aggregate metrics over recorded traffic.
   */
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly statistics: StatisticsService,
  ) {}

  /**
   * Subscribes to traffic / tunnel / replay events that change aggregates.
   */
  onModuleInit(): void {
    const refresh = (workspaceId: string | undefined): void => {
      // Anonymous / untagged traffic must never drive global dashboard stats.
      if (workspaceId === undefined || workspaceId.trim().length === 0) {
        return;
      }
      this.enqueueRefresh(workspaceId);
    };

    this.subscriptions.push(
      this.eventBus.subscribe(BadgerEventType.RequestReceived, (event) => {
        refresh(event.workspaceId);
      }),
      this.eventBus.subscribe(BadgerEventType.ResponseReturned, (event) => {
        refresh(event.workspaceId);
      }),
      this.eventBus.subscribe(BadgerEventType.RequestFailed, (event) => {
        refresh(event.workspaceId);
      }),
      this.eventBus.subscribe(BadgerEventType.ReplayCompleted, (event) => {
        refresh(event.workspaceId);
      }),
      this.eventBus.subscribe(BadgerEventType.TunnelCreated, (event) => {
        refresh(event.workspaceId);
      }),
      this.eventBus.subscribe(BadgerEventType.TunnelClosed, (event) => {
        refresh(event.workspaceId);
      }),
    );
  }

  /**
   * Cancels subscriptions.
   */
  onModuleDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;
  }

  private enqueueRefresh(workspaceId: string): void {
    this.chain = this.chain
      .catch(() => {
        // Prior failures must not block later publishes.
      })
      .then(async () => {
        const stats = await this.statistics.getStatistics({ workspaceId });
        this.publish(stats, workspaceId);
      });
  }

  private publish(stats: TrafficStatistics, workspaceId: string): void {
    this.eventBus.publish(
      BadgerEventType.StatisticsUpdated,
      createEventPayload({
        statistics: {
          totalRequests: stats.totalRequests,
          requestsPerMinute: stats.requestsPerMinute,
          averageLatencyMs: stats.averageLatencyMs,
          p95LatencyMs: stats.p95LatencyMs,
          errorRate: stats.errorRate,
        },
        tunnelId: undefined,
        workspaceId,
      }),
    );
  }
}
