import { HttpMethod } from "../types/http-forwarding.js";
import type { TrafficBody } from "../traffic/traffic-body.js";

/**
 * Stable error codes returned by {@link import("./request-replay.js").RequestReplayService}
 * and the management API.
 */
export const ReplayErrorCode = {
  NotFound: "NOT_FOUND",
  TunnelUnavailable: "TUNNEL_UNAVAILABLE",
  UnsupportedMethod: "UNSUPPORTED_METHOD",
  ForwardFailed: "FORWARD_FAILED",
} as const;

/**
 * Union of {@link ReplayErrorCode} values.
 */
export type ReplayErrorCode = (typeof ReplayErrorCode)[keyof typeof ReplayErrorCode];

/**
 * HTTP methods supported by request replay (matches the forward data plane).
 */
export const REPLAYABLE_HTTP_METHODS: readonly HttpMethod[] = [
  HttpMethod.GET,
  HttpMethod.POST,
  HttpMethod.PUT,
  HttpMethod.PATCH,
  HttpMethod.DELETE,
];

/**
 * Result of replaying a recorded request through the forwarding pipeline.
 */
export interface ReplayResult {
  /** Original traffic record request id. */
  readonly originalRequestId: string;
  /** Tunnel used for the replay. */
  readonly tunnelId: string;
  /** Replayed HTTP method. */
  readonly method: HttpMethod;
  /** Replayed path. */
  readonly path: string;
  /** HTTP status returned by the local app via the tunnel. */
  readonly statusCode: number;
  /** Response headers (excluding Set-Cookie). */
  readonly headers: Readonly<Record<string, string | readonly string[]>>;
  /** Raw Set-Cookie values. */
  readonly setCookies: readonly string[];
  /** Response body snapshot. */
  readonly body: TrafficBody;
  /** `true` when the recorded request body was truncated before replay. */
  readonly requestBodyTruncated: boolean;
}

/**
 * Typed failure from request replay.
 */
export class ReplayError extends Error {
  /**
   * @param code - Stable machine-readable code.
   * @param message - Human-readable description.
   */
  constructor(
    readonly code: ReplayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReplayError";
  }
}

/**
 * JSON DTO returned by `POST /api/v1/traffic/:requestId/replay`.
 */
export interface ReplayResponseDto {
  readonly originalRequestId: string;
  readonly tunnelId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | readonly string[]>>;
  readonly setCookies: readonly string[];
  readonly bodyBase64: string;
  readonly bodyByteLength: number;
  readonly bodyTruncated: boolean;
  readonly requestBodyTruncated: boolean;
}

/**
 * Maps a {@link ReplayResult} to the public API DTO.
 *
 * @param result - Replay service result.
 * @returns JSON-serializable DTO.
 */
export function toReplayResponseDto(result: ReplayResult): ReplayResponseDto {
  return {
    originalRequestId: result.originalRequestId,
    tunnelId: result.tunnelId,
    method: result.method,
    path: result.path,
    statusCode: result.statusCode,
    headers: result.headers,
    setCookies: result.setCookies,
    bodyBase64: result.body.dataBase64,
    bodyByteLength: result.body.byteLength,
    bodyTruncated: result.body.truncated,
    requestBodyTruncated: result.requestBodyTruncated,
  };
}
