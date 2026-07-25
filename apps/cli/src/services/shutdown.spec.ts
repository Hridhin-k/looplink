import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { ShutdownController } from "./shutdown.js";

function setup(overrides: Record<string, unknown> = {}) {
  const emitter = new EventEmitter();
  const exit = vi.fn();
  const onShutdownStart = vi.fn();
  const onShutdownComplete = vi.fn();
  const onTaskError = vi.fn();

  const controller = new ShutdownController({
    emitter,
    exit,
    onShutdownStart,
    onShutdownComplete,
    onTaskError,
    ...overrides,
  });

  controller.install();

  return { controller, emitter, exit, onShutdownStart, onShutdownComplete, onTaskError };
}

/** Lets the controller's async signal handler settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("ShutdownController", () => {
  it("runs registered tasks and exits cleanly on SIGINT", async () => {
    const { controller, emitter, exit, onShutdownStart, onShutdownComplete } = setup();
    const task = vi.fn();

    controller.register(task);
    emitter.emit("SIGINT");
    await flush();

    expect(onShutdownStart).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(1);
    expect(onShutdownComplete).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("also handles SIGTERM", async () => {
    const { controller, emitter, exit } = setup();
    const task = vi.fn();

    controller.register(task);
    emitter.emit("SIGTERM");
    await flush();

    expect(task).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("awaits async tasks in registration order", async () => {
    const { controller, emitter, exit } = setup();
    const order: string[] = [];

    controller.register(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      order.push("first");
    });
    controller.register(() => {
      order.push("second");
    });

    emitter.emit("SIGINT");
    await flush();
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });

    expect(order).toEqual(["first", "second"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("continues shutdown when a task throws", async () => {
    const { controller, emitter, exit, onTaskError } = setup();
    const second = vi.fn();

    controller.register(() => {
      throw new Error("disconnect failed");
    });
    controller.register(second);

    emitter.emit("SIGINT");
    await flush();

    expect(onTaskError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "disconnect failed" }),
    );
    expect(second).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("force-exits when a second signal arrives during shutdown", async () => {
    const { controller, emitter, exit } = setup();
    let release: (() => void) | undefined;

    controller.register(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    emitter.emit("SIGINT");
    await flush();
    emitter.emit("SIGINT");
    await flush();

    expect(exit).toHaveBeenCalledWith(130);

    release?.();
  });

  it("ignores repeat install calls", async () => {
    const { controller, emitter, onShutdownStart } = setup();

    controller.install();
    controller.install();
    emitter.emit("SIGINT");
    await flush();

    expect(onShutdownStart).toHaveBeenCalledTimes(1);
  });
});
