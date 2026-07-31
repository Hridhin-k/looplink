/** Serialized HTTP body snapshot from the inspector API. */
export interface TrafficBody {
  readonly byteLength: number;
  readonly truncated: boolean;
  readonly dataBase64: string;
}

/** Summary row from `GET /api/v1/inspector/requests`. */
export interface InspectorRequestSummary {
  readonly id: string;
  readonly timestamp: number;
  readonly method: string;
  readonly path: string;
  readonly status?: number;
  readonly latencyMs?: number;
  readonly tunnelId: string;
  readonly workspaceId?: string;
  readonly error?: string;
  readonly requestBodyByteLength: number;
  readonly responseBodyByteLength: number;
  /** Fields matched by full-text `q` (when searching). */
  readonly matches?: readonly string[];
}

/** List response from `GET /api/v1/inspector/requests`. */
export interface InspectorRequestList {
  readonly items: readonly InspectorRequestSummary[];
  readonly count: number;
}

/** Detail from `GET /api/v1/inspector/request/:id`. */
export interface InspectorRequestDetail {
  readonly id: string;
  readonly timestamp: number;
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string | readonly string[]>;
  readonly query: Record<string, string | readonly string[]>;
  readonly body: TrafficBody;
  readonly status?: number;
  readonly responseHeaders: Record<string, string | readonly string[]>;
  readonly responseBody: TrafficBody;
  readonly latencyMs?: number;
  readonly tunnelId: string;
  readonly workspaceId?: string;
  readonly error?: string;
}

/** Response from `POST /api/v1/inspector/replay/:id`. */
export interface InspectorReplayResponse {
  readonly originalRequestId: string;
  readonly tunnelId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly headers: Record<string, string | readonly string[]>;
  readonly setCookies: readonly string[];
  readonly bodyBase64: string;
  readonly bodyByteLength: number;
  readonly bodyTruncated: boolean;
  readonly requestBodyTruncated: boolean;
}

/** Method histogram entry. */
export interface MethodCount {
  readonly method: string;
  readonly count: number;
}

/** Status-code histogram entry. */
export interface StatusCodeCount {
  readonly statusCode: number;
  readonly count: number;
}

/** Top endpoint entry. */
export interface EndpointCount {
  readonly path: string;
  readonly method: string;
  readonly count: number;
}

/** Per-tunnel aggregate from statistics. */
export interface TunnelStatistics {
  readonly tunnelId: string;
  readonly totalRequests: number;
  readonly errorRate: number;
  readonly averageLatencyMs?: number;
  readonly p95LatencyMs?: number;
  readonly methodCounts: readonly MethodCount[];
  readonly statusCodeCounts: readonly StatusCodeCount[];
  readonly topEndpoints: readonly EndpointCount[];
}

/** Response from `GET /api/v1/inspector/statistics`. */
export interface InspectorStatistics {
  readonly totalRequests: number;
  readonly requestsPerMinute: number;
  readonly averageLatencyMs?: number;
  readonly p95LatencyMs?: number;
  readonly errorRate: number;
  readonly methodCounts: readonly MethodCount[];
  readonly statusCodeCounts: readonly StatusCodeCount[];
  readonly topEndpoints: readonly EndpointCount[];
  readonly tunnels: readonly TunnelStatistics[];
}
