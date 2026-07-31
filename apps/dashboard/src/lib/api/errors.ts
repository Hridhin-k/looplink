/**
 * HTTP failure from the Badger inspector / management API.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: unknown;

  /**
   * @param status - HTTP status code.
   * @param path - Request path relative to the API base.
   * @param body - Parsed error payload when available.
   */
  constructor(status: number, path: string, body: unknown) {
    super(`API ${String(status)} ${path}`);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

/**
 * User-facing message from an {@link ApiError}, preferring the Nest `message` body.
 */
export function formatApiErrorMessage(error: ApiError, fallback?: string): string {
  if (typeof error.body === "object" && error.body !== null && "message" in error.body) {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.map(String).join(", ");
    }
  }
  if (typeof error.body === "string" && error.body.trim().length > 0) {
    return error.body;
  }
  if (fallback !== undefined && fallback.trim().length > 0) {
    return fallback;
  }
  if (error.status === 401) {
    return "Your session expired. Sign in again and retry.";
  }
  return error.message;
}

/**
 * Network / CORS failure talking to the Badger API (no HTTP response).
 */
export class NetworkError extends Error {
  readonly path: string;

  /**
   * @param path - Request path relative to the API base.
   * @param cause - Underlying fetch failure when available.
   */
  constructor(path: string, cause?: unknown) {
    const detail =
      cause instanceof Error && cause.message.length > 0
        ? cause.message
        : "Failed to reach the Badger server";
    super(`${detail} (${path})`);
    this.name = "NetworkError";
    this.path = path;
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}
