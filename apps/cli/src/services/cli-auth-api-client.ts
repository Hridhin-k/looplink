import { websocketUrlToHttpBaseUrl } from "@hridhin-k/badger-shared";

export interface CliAuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly user: {
    readonly id: string;
    readonly email: string | null;
  };
}

export interface CliWhoAmI {
  readonly id: string;
  readonly email: string | null;
  readonly authMethod?: "jwt" | "api_key";
  readonly workspaceId?: string;
  readonly apiKeyId?: string;
}

export interface CliWorkspaceMembership {
  readonly id: string;
  readonly role: string;
  readonly workspace: {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
  };
}

export interface CliOAuthConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly provider: string;
}

export class CliAuthApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async refresh(serverWebsocketUrl: string, refreshToken: string): Promise<CliAuthSession> {
    const result = await this.request<CliAuthSession>(
      this.url(serverWebsocketUrl, "/api/v1/auth/refresh"),
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      },
    );
    if (result === undefined) {
      throw new Error("Refresh response was empty.");
    }
    return result;
  }

  async logout(serverWebsocketUrl: string, accessToken: string): Promise<void> {
    await this.request(
      this.url(serverWebsocketUrl, "/api/v1/auth/logout"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
      },
      true,
    );
  }

  async whoami(serverWebsocketUrl: string, accessToken: string): Promise<CliWhoAmI> {
    const result = await this.request<CliWhoAmI>(this.url(serverWebsocketUrl, "/api/v1/me"), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (result === undefined) {
      throw new Error("whoami response was empty.");
    }
    return result;
  }

  async listWorkspaces(
    serverWebsocketUrl: string,
    accessToken: string,
  ): Promise<CliWorkspaceMembership[]> {
    const result = await this.request<CliWorkspaceMembership[]>(
      this.url(serverWebsocketUrl, "/api/v1/workspaces"),
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
      },
    );
    if (result === undefined) {
      throw new Error("Workspace list response was empty.");
    }
    return result;
  }

  async getOAuthConfig(serverWebsocketUrl: string): Promise<CliOAuthConfig> {
    const result = await this.request<CliOAuthConfig>(
      this.url(serverWebsocketUrl, "/api/v1/auth/cli/config"),
      {
      method: "GET",
      headers: { accept: "application/json" },
      },
    );
    if (result === undefined) {
      throw new Error("OAuth config response was empty.");
    }
    return result;
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
          : `Auth request failed (${String(response.status)}).`;
      if (response.status === 404 && url.includes("/api/v1/auth/cli/config")) {
        throw new Error(
          `${message} Is the Badger server running the latest build? For local: badger login -s ws://localhost:8080`,
        );
      }
      throw new Error(message);
    }

    return payload as T;
  }
}
