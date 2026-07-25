/**
 * Successful health-check payload returned by `GET /health`.
 */
export interface HealthResponse {
  readonly status: "ok";
}
