import type { EventEmitter } from "node:events";

/**
 * Cleanup performed before the process exits.
 */
export type ShutdownTask = () => Promise<void> | void;

/**
 * Registry of cleanup work to run on Ctrl+C or a termination signal.
 */
export interface ShutdownRegistry {
  /**
   * Adds a task to run during shutdown, in registration order.
   *
   * @param task - Cleanup callback.
   */
  register(task: ShutdownTask): void;
}

/**
 * Configuration for {@link ShutdownController}.
 */
export interface ShutdownControllerOptions {
  /** Signals that trigger a graceful shutdown. */
  readonly signals?: readonly NodeJS.Signals[];
  /** Emitter that delivers the signals. Defaults to `process`. */
  readonly emitter?: EventEmitter;
  /** Terminates the process. Defaults to `process.exit`. */
  readonly exit?: (code: number) => void;
  /** Invoked once when the first signal arrives. */
  readonly onShutdownStart?: () => void;
  /** Invoked after every task finished successfully. */
  readonly onShutdownComplete?: () => void;
  /** Invoked when a task throws; shutdown continues regardless. */
  readonly onTaskError?: (error: Error) => void;
}

/** Conventional exit code for a process killed by an impatient Ctrl+C. */
const FORCED_EXIT_CODE = 130;

/**
 * Runs registered cleanup on Ctrl+C, then exits.
 *
 * A second signal during shutdown exits immediately, so a hung cleanup can
 * never trap the user in an unresponsive terminal.
 */
export class ShutdownController implements ShutdownRegistry {
  private readonly tasks: ShutdownTask[] = [];
  private readonly signals: readonly NodeJS.Signals[];
  private readonly emitter: EventEmitter;
  private readonly exit: (code: number) => void;
  private shuttingDown = false;
  private installed = false;

  /**
   * @param options - Signal set and injectable process collaborators.
   */
  constructor(private readonly options: ShutdownControllerOptions = {}) {
    this.signals = options.signals ?? ["SIGINT", "SIGTERM"];
    this.emitter = options.emitter ?? process;
    this.exit =
      options.exit ??
      ((code: number): void => {
        process.exit(code);
      });
  }

  /**
   * Adds a task to run during shutdown, in registration order.
   *
   * @param task - Cleanup callback.
   */
  register(task: ShutdownTask): void {
    this.tasks.push(task);
  }

  /**
   * Subscribes to the configured signals. Repeat calls are ignored.
   */
  install(): void {
    if (this.installed) {
      return;
    }

    this.installed = true;

    for (const signal of this.signals) {
      this.emitter.on(signal, () => {
        void this.handleSignal();
      });
    }
  }

  /**
   * Runs every registered task and exits with code `0`.
   *
   * Task failures are reported through `onTaskError` and do not stop the
   * remaining cleanup.
   *
   * @returns A promise that resolves once cleanup finished and exit was called.
   */
  async shutdown(): Promise<void> {
    this.options.onShutdownStart?.();

    for (const task of this.tasks) {
      try {
        await task();
      } catch (error: unknown) {
        this.options.onTaskError?.(
          error instanceof Error ? error : new Error("Shutdown task failed."),
        );
      }
    }

    this.options.onShutdownComplete?.();
    this.exit(0);
  }

  private async handleSignal(): Promise<void> {
    if (this.shuttingDown) {
      this.exit(FORCED_EXIT_CODE);
      return;
    }

    this.shuttingDown = true;
    await this.shutdown();
  }
}
