import { Logger, type OnModuleDestroy } from "@nestjs/common";
import { HEARTBEAT_TIMEOUT_MS } from "@looplink/shared";
import type WebSocket from "ws";

/**
 * Tracks the last heartbeat of every connected client and terminates sockets
 * that stay silent longer than the configured timeout.
 *
 * The gateway drives it: `register` on connect, `beat` on each `PING`, and
 * `unregister` on disconnect. A single shared sweep timer runs only while at
 * least one client is tracked.
 *
 * Registered via a factory provider (see `GatewayModule`) because the numeric
 * constructor parameters carry defaults instead of DI tokens.
 */
export class HeartbeatMonitor implements OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatMonitor.name);
  private readonly lastBeatAt = new Map<WebSocket, number>();
  private sweepTimer: ReturnType<typeof setInterval> | undefined;
  private readonly sweepIntervalMs: number;

  /**
   * @param timeoutMs - Silence duration after which a client is disconnected.
   * @param sweepIntervalMs - How often stale clients are checked for. Defaults
   *   to a quarter of the timeout so the worst-case overshoot stays small.
   */
  constructor(
    private readonly timeoutMs: number = HEARTBEAT_TIMEOUT_MS,
    sweepIntervalMs?: number,
  ) {
    this.sweepIntervalMs = sweepIntervalMs ?? Math.ceil(timeoutMs / 4);
  }

  /**
   * Starts tracking a newly connected client. The connection itself counts as
   * the first heartbeat, so a client that never pings is dropped after the
   * timeout rather than immediately.
   *
   * @param client - The connected `ws` socket.
   */
  register(client: WebSocket): void {
    this.lastBeatAt.set(client, Date.now());
    this.ensureSweepTimer();
  }

  /**
   * Records a heartbeat for a tracked client. Beats from unknown sockets are
   * ignored so a race with disconnect cannot resurrect tracking.
   *
   * @param client - The socket that sent a `PING`.
   */
  beat(client: WebSocket): void {
    if (this.lastBeatAt.has(client)) {
      this.lastBeatAt.set(client, Date.now());
    }
  }

  /**
   * Stops tracking a client. Called on disconnect, whatever the cause.
   *
   * @param client - The socket to forget.
   */
  unregister(client: WebSocket): void {
    this.lastBeatAt.delete(client);

    if (this.lastBeatAt.size === 0) {
      this.stopSweepTimer();
    }
  }

  /**
   * @returns The number of clients currently tracked.
   */
  trackedClientCount(): number {
    return this.lastBeatAt.size;
  }

  /**
   * Clears the sweep timer on application shutdown.
   */
  onModuleDestroy(): void {
    this.stopSweepTimer();
  }

  private ensureSweepTimer(): void {
    if (this.sweepTimer !== undefined) {
      return;
    }

    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, this.sweepIntervalMs);

    // The sweep must never keep the process alive on its own.
    this.sweepTimer.unref();
  }

  private stopSweepTimer(): void {
    if (this.sweepTimer !== undefined) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  private sweep(): void {
    const now = Date.now();

    for (const [client, lastBeatAt] of this.lastBeatAt) {
      if (now - lastBeatAt <= this.timeoutMs) {
        continue;
      }

      this.logger.warn(
        `Disconnecting client: no heartbeat for ${String(now - lastBeatAt)}ms ` +
          `(timeout ${String(this.timeoutMs)}ms)`,
      );

      // Forget the client first so the close handler's unregister is a no-op.
      this.lastBeatAt.delete(client);
      client.terminate();
    }

    if (this.lastBeatAt.size === 0) {
      this.stopSweepTimer();
    }
  }
}
