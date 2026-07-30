/**
 * Successful health-check payload returned by `GET /health`.
 */
export interface HealthResponse {
  readonly status: "ok";
}

/**
 * Readiness payload for orchestrators (`GET /health/ready`).
 */
export interface ReadyResponse {
  readonly status: "ready" | "not_ready";
  readonly checks: {
    readonly database: "ok" | "skip" | "error";
  };
}
