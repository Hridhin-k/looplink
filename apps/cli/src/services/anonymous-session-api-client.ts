import { websocketUrlToHttpBaseUrl } from "@hridhin-k/badger-shared";

export interface CreatedAnonymousSessionResponse {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: string;
}

/**
 * HTTP client for minting / destroying ephemeral anonymous tunnel sessions.
 */
export class AnonymousSessionApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async create(serverWebsocketUrl: string): Promise<CreatedAnonymousSessionResponse> {
    const result = await this.request<CreatedAnonymousSessionResponse>(
      this.url(serverWebsocketUrl, "/api/v1/anonymous-sessions"),
      {
        method: "POST",
        headers: { accept: "application/json" },
      },
    );
    if (result === undefined) {
      throw new Error("Anonymous session response was empty.");
    }
    return result;
  }

  async destroy(serverWebsocketUrl: string, token: string): Promise<void> {
    await this.request(
      this.url(serverWebsocketUrl, "/api/v1/anonymous-sessions"),
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
          "x-anonymous-session": token,
        },
      },
      true,
    );
  }

  private url(serverWebsocketUrl: string, path: string): string {
    return `${websocketUrlToHttpBaseUrl(serverWebsocketUrl)}${path}`;
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    allow204 = false,
  ): Promise<T | undefined> {
    const response = await this.fetchImpl(url, init);

    if (allow204 && response.status === 204) {
      return undefined;
    }

    const payload = (await response.json().catch(() => undefined)) as
      | { message?: string }
      | T
      | undefined;

    if (!response.ok) {
      const message =
        payload !== undefined &&
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : `Anonymous session request failed (${String(response.status)}).`;
      throw new Error(message);
    }

    return payload as T;
  }
}
