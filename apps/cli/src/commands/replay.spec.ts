import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplayCommand } from "./replay.js";
import { ReplayApiClient, ReplayClientError } from "../services/replay-api-client.js";
import type { Writer } from "../utils/output.js";

describe("ReplayCommand", () => {
  const lines: string[] = [];
  const errors: string[] = [];
  const writer: Writer = {
    writeLine: (message) => {
      lines.push(message);
    },
    writeError: (message) => {
      errors.push(message);
    },
  };

  afterEach(() => {
    lines.length = 0;
    errors.length = 0;
    process.exitCode = undefined;
  });

  it("prints the replay response body", async () => {
    const client = {
      replay: vi.fn().mockResolvedValue({
        originalRequestId: "req-1",
        tunnelId: "tun-1",
        method: "POST",
        path: "/echo",
        statusCode: 200,
        headers: {},
        setCookies: [],
        bodyBase64: Buffer.from("ok").toString("base64"),
        bodyByteLength: 2,
        bodyTruncated: false,
        requestBodyTruncated: false,
      }),
    } as unknown as ReplayApiClient;

    const command = new ReplayCommand(client, writer);
    await command.execute("req-1", { server: "ws://127.0.0.1:8080" });

    expect(client.replay).toHaveBeenCalledWith("ws://127.0.0.1:8080", "req-1");
    expect(lines[0]).toContain("POST /echo → 200");
    expect(lines).toContain("ok");
    expect(process.exitCode).toBeUndefined();
  });

  it("writes client errors to stderr", async () => {
    const client = {
      replay: vi.fn().mockRejectedValue(new ReplayClientError("NOT_FOUND", "missing", 404)),
    } as unknown as ReplayApiClient;

    const command = new ReplayCommand(client, writer);
    await command.execute("missing");

    expect(errors.some((line) => line.includes("NOT_FOUND"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });
});
