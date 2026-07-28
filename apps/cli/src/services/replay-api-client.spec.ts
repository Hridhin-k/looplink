import { describe, expect, it, vi } from "vitest";

import { ReplayApiClient, ReplayClientError } from "./replay-api-client.js";

describe("ReplayApiClient", () => {
  it("posts to the replay endpoint derived from the websocket URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        originalRequestId: "req-1",
        tunnelId: "tun-1",
        method: "GET",
        path: "/",
        statusCode: 200,
        headers: {},
        setCookies: [],
        bodyBase64: "",
        bodyByteLength: 0,
        bodyTruncated: false,
        requestBodyTruncated: false,
      }),
    });

    const client = new ReplayApiClient(fetchImpl as unknown as typeof fetch);
    const result = await client.replay("ws://127.0.0.1:8080", "req-1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/v1/traffic/req-1/replay",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.statusCode).toBe(200);
  });

  it("throws ReplayClientError on HTTP failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: "NOT_FOUND", message: "missing" }),
    });

    const client = new ReplayApiClient(fetchImpl as unknown as typeof fetch);

    await expect(client.replay("ws://127.0.0.1:8080", "missing")).rejects.toBeInstanceOf(
      ReplayClientError,
    );
  });
});
