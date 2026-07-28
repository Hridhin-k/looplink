import { HEARTBEAT_INTERVAL_MS } from "@hridhin-k/badger-shared";

/**
 * Periodic keepalive loop.
 *
 * Owns only the timer; the caller decides what a "beat" does (sending a
 * `PING`), which keeps this class trivially unit-testable with fake timers.
 */
export class Heartbeat {
  private timer: ReturnType<typeof setInterval> | undefined;

  /**
   * @param beat - Invoked once per interval while the heartbeat is running.
   * @param intervalMs - Delay between beats. Defaults to the shared protocol
   *   interval so CLI and server stay in agreement.
   */
  constructor(
    private readonly beat: () => void,
    private readonly intervalMs: number = HEARTBEAT_INTERVAL_MS,
  ) {}

  /**
   * Starts the loop. Calling `start` while already running is a no-op so a
   * reconnect cannot stack duplicate timers.
   */
  start(): void {
    if (this.timer !== undefined) {
      return;
    }

    this.timer = setInterval(() => {
      this.beat();
    }, this.intervalMs);

    // Never keep the process alive just to send pings.
    this.timer.unref();
  }

  /**
   * Stops the loop. Safe to call when not running.
   */
  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * @returns `true` while the interval timer is active.
   */
  isRunning(): boolean {
    return this.timer !== undefined;
  }
}
