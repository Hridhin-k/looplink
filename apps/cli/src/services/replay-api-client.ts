import type { ReplayResponseDto } from "@hridhin-k/badger-shared";
import { ReplayErrorCode, websocketUrlToHttpBaseUrl } from "@hridhin-k/badger-shared";

/**
 * HTTP client that triggers request replay on the Badger server.
 */
export class ReplayApiClient {
  /**
   * @param fetchImpl - Injected fetch (defaults to global fetch).
   */
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /**
   * POSTs to `/api/v1/traffic/:requestId/replay`.
   *
   * @param serverWebsocketUrl - Badger server `ws://` / `wss://` URL.
   * @param requestId - Traffic record id to replay.
   * @returns Replay response DTO from the server.
   */
  async replay(serverWebsocketUrl: string, requestId: string): Promise<ReplayResponseDto> {
    const baseUrl = websocketUrlToHttpBaseUrl(serverWebsocketUrl);
    const url = `${baseUrl}/api/v1/traffic/${encodeURIComponent(requestId)}/replay`;

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { accept: "application/json" },
    });

    const payload = (await response.json().catch(() => undefined)) as
      ReplayResponseDto | { message?: string; code?: string } | undefined;

    if (!response.ok) {
      const message =
        payload !== undefined && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : `Replay failed with HTTP ${String(response.status)}.`;
      const code =
        payload !== undefined && "code" in payload && typeof payload.code === "string"
          ? payload.code
          : ReplayErrorCode.ForwardFailed;
      throw new ReplayClientError(code, message, response.status);
    }

    if (payload === undefined || !isReplayResponseDto(payload)) {
      throw new ReplayClientError(
        ReplayErrorCode.ForwardFailed,
        "Server returned an invalid replay response.",
        response.status,
      );
    }

    return payload;
  }
}

/**
 * Error thrown by {@link ReplayApiClient} for non-success responses.
 */
export class ReplayClientError extends Error {
  /**
   * @param code - Server or client error code.
   * @param message - Human-readable description.
   * @param statusCode - HTTP status from the server when available.
   */
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ReplayClientError";
  }
}

/**
 * Narrows an unknown JSON body to {@link ReplayResponseDto}.
 *
 * @param value - Parsed JSON.
 * @returns `true` when required fields are present.
 */
function isReplayResponseDto(value: unknown): value is ReplayResponseDto {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record["originalRequestId"] === "string" &&
    typeof record["tunnelId"] === "string" &&
    typeof record["method"] === "string" &&
    typeof record["path"] === "string" &&
    typeof record["statusCode"] === "number" &&
    typeof record["bodyBase64"] === "string" &&
    typeof record["bodyByteLength"] === "number" &&
    typeof record["requestBodyTruncated"] === "boolean" &&
    Array.isArray(record["setCookies"])
  );
}
