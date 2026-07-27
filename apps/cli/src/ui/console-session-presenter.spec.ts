import { describe, expect, it, vi } from "vitest";

import { ConsoleSessionPresenter } from "./console-session-presenter.js";
import type { Spinner } from "./spinner.js";
import type { Writer } from "../utils/output.js";

/** Removes ANSI styling so assertions are color-agnostic. */
// eslint-disable-next-line no-control-regex
const ANSI = /\u001B\[[0-9;]*m/g;

function strip(text: string): string {
  return text.replace(ANSI, "");
}

function createWriter(): Writer & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];

  return {
    lines,
    errors,
    writeLine: (message: string) => lines.push(message),
    writeError: (message: string) => errors.push(message),
  };
}

function createSpinnerStub(): Spinner & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    start: (text) => calls.push(`start:${strip(text)}`),
    update: (text) => calls.push(`update:${strip(text)}`),
    succeed: (text) => calls.push(`succeed:${strip(text)}`),
    fail: (text) => calls.push(`fail:${strip(text)}`),
    warn: (text) => calls.push(`warn:${strip(text)}`),
    stop: () => calls.push("stop"),
  };
}

function setup(options?: { showQrCode?: boolean; copyUrl?: boolean; copySucceeds?: boolean }) {
  const writer = createWriter();
  const spinner = createSpinnerStub();
  const copyToClipboard = vi.fn().mockResolvedValue(options?.copySucceeds ?? true);
  const renderQrCode = vi.fn().mockResolvedValue("[QR]");

  const presenter = new ConsoleSessionPresenter(
    writer,
    spinner,
    {
      showQrCode: options?.showQrCode ?? true,
      copyUrl: options?.copyUrl ?? true,
    },
    { copyToClipboard, renderQrCode },
  );

  const output = (): string => writer.lines.map(strip).join("\n");

  return { presenter, writer, spinner, copyToClipboard, renderQrCode, output };
}

describe("ConsoleSessionPresenter", () => {
  it("shows a spinner while starting and resolves it once connected", async () => {
    const { presenter, spinner } = setup();

    presenter.starting(3000);
    presenter.connected();
    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });

    expect(spinner.calls[0]).toContain("start:Starting Badger on port 3000");
    expect(spinner.calls[1]).toContain("update:Connected to Badger server.");
    expect(spinner.calls[2]).toBe("succeed:Connected to Badger server.");
  });

  it("renders the URL, local target, clipboard status, QR code and stop hint", async () => {
    const { presenter, copyToClipboard, renderQrCode, output } = setup();

    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });

    const text = output();

    expect(text).toContain("Tunnel Created");
    expect(text).toContain("https://a.badger.dev");
    expect(text).toContain("http://localhost:3000");
    expect(text).toContain("URL copied");
    expect(text).toContain("[QR]");
    expect(text).toContain("Press Ctrl+C to stop");
    expect(copyToClipboard).toHaveBeenCalledWith("https://a.badger.dev");
    expect(renderQrCode).toHaveBeenCalledWith("https://a.badger.dev");
  });

  it("reports clipboard failures without throwing", async () => {
    const { presenter, output } = setup({ copySucceeds: false });

    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });

    expect(output()).toContain("unavailable on this system");
  });

  it("skips the QR code and clipboard when disabled", async () => {
    const { presenter, copyToClipboard, renderQrCode, output } = setup({
      showQrCode: false,
      copyUrl: false,
    });

    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });

    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(renderQrCode).not.toHaveBeenCalled();
    expect(output()).not.toContain("Clipboard");
  });

  it("does not redraw the QR code when a reconnect restores the same URL", async () => {
    const { presenter, renderQrCode, spinner, output } = setup();

    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });
    await presenter.reconnected({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: true,
    });

    expect(renderQrCode).toHaveBeenCalledTimes(1);
    expect(spinner.calls).toContain("succeed:Reconnected. Tunnel restored.");
    expect(output()).toContain("Tunnel Restored");
  });

  it("redraws the QR code when a reconnect yields a new URL", async () => {
    const { presenter, renderQrCode, output } = setup();

    await presenter.tunnelReady({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: false,
    });
    await presenter.reconnected({
      publicUrl: "https://b.badger.dev",
      port: 3000,
      restored: false,
    });

    expect(renderQrCode).toHaveBeenCalledTimes(2);
    expect(output()).toContain("https://b.badger.dev");
  });

  it("warns on connection loss and reports retry failures", () => {
    const { presenter, spinner } = setup();

    presenter.connectionLost();
    presenter.reconnectFailed(new Error("ECONNREFUSED"));

    expect(spinner.calls[0]).toContain("start:Connection lost. Reconnecting to Badger...");
    expect(spinner.calls[1]).toContain("update:Reconnect failed: ECONNREFUSED. Retrying...");
  });

  it("announces an outage once instead of on every retry", async () => {
    const { presenter, spinner } = setup();

    presenter.connectionLost();
    presenter.reconnectFailed(new Error("ECONNREFUSED"));
    presenter.connectionLost();
    presenter.reconnectFailed(new Error("ECONNREFUSED"));

    const announcements = spinner.calls.filter((call) => call.startsWith("start:Connection lost"));
    expect(announcements).toHaveLength(1);

    // A later outage is announced again once the session has recovered.
    await presenter.reconnected({
      publicUrl: "https://a.badger.dev",
      port: 3000,
      restored: true,
    });
    presenter.connectionLost();

    expect(spinner.calls.filter((call) => call.startsWith("start:Connection lost"))).toHaveLength(
      2,
    );
  });

  it("falls back to a readable reason when the error has no message", () => {
    const { presenter, spinner } = setup();

    presenter.connectionLost();
    presenter.reconnectFailed(new Error(""));

    expect(spinner.calls[1]).toContain("update:Reconnect failed: server unreachable. Retrying...");
  });

  it("fails the spinner when the session cannot start", () => {
    const { presenter, spinner } = setup();

    presenter.failed("connection refused");

    expect(spinner.calls).toContain("fail:Failed to create tunnel: connection refused");
  });

  it("clears the spinner and confirms a clean stop on shutdown", () => {
    const { presenter, spinner, output } = setup();

    presenter.shuttingDown();
    presenter.stopped();

    expect(spinner.calls).toContain("stop");
    expect(output()).toContain("Stopping Badger...");
    expect(output()).toContain("Tunnel closed. Goodbye.");
  });
});
