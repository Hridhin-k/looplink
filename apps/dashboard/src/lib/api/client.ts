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

  const method = (rest.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = readBrowserCookie("badger_csrf");
    if (csrf !== undefined && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body,
      // Cookie sessions need `include` + server `Access-Control-Allow-Credentials`.
      // Bearer SPA mode must use `omit` — otherwise browsers fail CORS as "Failed to fetch".
      credentials: rest.credentials ?? defaultCredentialsMode(),
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

function defaultCredentialsMode(): RequestCredentials {
  const raw = process.env["NEXT_PUBLIC_BADGER_AUTH_COOKIE_ENABLED"]?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") {
    return "include";
  }
  return "omit";
}

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    if (trimmed.slice(0, idx) !== name) {
      continue;
    }
    try {
      return decodeURIComponent(trimmed.slice(idx + 1));
    } catch {
      return trimmed.slice(idx + 1);
    }
  }
  return undefined;
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
