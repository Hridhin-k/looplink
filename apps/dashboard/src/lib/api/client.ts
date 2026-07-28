import { getApiBaseUrl } from "@/lib/env";

import { ApiError, NetworkError } from "./errors";

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  /** JSON-serializable body (sets `Content-Type: application/json`). */
  readonly json?: unknown;
  /** Raw body when not using `json`. */
  readonly body?: BodyInit | null;
};

/**
 * Typed fetch wrapper for the Badger server HTTP API.
 *
 * Always targets {@link getApiBaseUrl}; never imports server internals.
 */
export async function apiClient<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { json, headers: initHeaders, body: rawBody, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let body: BodyInit | null | undefined = rawBody;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body,
    });
  } catch (cause: unknown) {
    throw new NetworkError(normalizedPath, cause);
  }

  if (!response.ok) {
    throw new ApiError(response.status, normalizedPath, await readErrorBody(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}
