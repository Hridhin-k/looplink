import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { CliAuthApiClient, type CliAuthSession } from "./cli-auth-api-client.js";

interface StoredAuthSession {
  readonly serverUrl: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly authMethod: "jwt" | "api_key";
  readonly user: {
    readonly id: string;
    readonly email: string | null;
    readonly workspaceId?: string;
    readonly apiKeyId?: string;
  };
}

const TOKEN_SKEW_SECONDS = 60;
/** API keys do not expire via refresh; treat as long-lived until revoked. */
const API_KEY_EXPIRES_AT = Math.floor(Date.now() / 1000) + 100 * 365 * 24 * 60 * 60;

export class AuthSessionManager {
  private readonly filePath: string;

  constructor(private readonly authApi: CliAuthApiClient) {
    this.filePath = join(homedir(), ".config", "badger", "auth.json");
  }

  load(serverUrl: string): StoredAuthSession | undefined {
    const stored = this.readFromDisk();
    if (stored === undefined) {
      return undefined;
    }
    if (stored.serverUrl !== serverUrl) {
      return undefined;
    }
    return stored;
  }

  save(serverUrl: string, session: CliAuthSession): void {
    const stored: StoredAuthSession = {
      serverUrl,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      authMethod: "jwt",
      user: { ...session.user },
    };
    this.writeToDisk(stored);
  }

  saveApiKey(
    serverUrl: string,
    token: string,
    user: {
      readonly id: string;
      readonly email: string | null;
      readonly workspaceId?: string;
      readonly apiKeyId?: string;
    },
  ): void {
    const stored: StoredAuthSession = {
      serverUrl,
      accessToken: token,
      refreshToken: "",
      expiresAt: API_KEY_EXPIRES_AT,
      authMethod: "api_key",
      user: { ...user },
    };
    this.writeToDisk(stored);
  }

  clear(): void {
    try {
      writeFileSync(this.filePath, "", { mode: 0o600 });
    } catch {
      // no-op
    }
  }

  async getValidAccessToken(serverUrl: string): Promise<string | undefined> {
    const existing = this.load(serverUrl);
    if (existing === undefined) {
      return undefined;
    }

    if (existing.authMethod === "api_key") {
      return existing.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    if (existing.expiresAt > now + TOKEN_SKEW_SECONDS) {
      return existing.accessToken;
    }

    if (existing.refreshToken.trim().length === 0) {
      return undefined;
    }

    const refreshed = await this.authApi.refresh(serverUrl, existing.refreshToken);
    this.save(serverUrl, refreshed);
    return refreshed.accessToken;
  }

  private writeToDisk(stored: StoredAuthSession): void {
    const parent = dirname(this.filePath);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true, mode: 0o700 });
    }

    writeFileSync(this.filePath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
    chmodSync(this.filePath, 0o600);
  }

  private readFromDisk(): StoredAuthSession | undefined {
    try {
      if (!existsSync(this.filePath)) {
        return undefined;
      }
      const raw = readFileSync(this.filePath, "utf8").trim();
      if (raw.length === 0) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const user = parsed["user"];
      if (
        typeof parsed["serverUrl"] !== "string" ||
        typeof parsed["accessToken"] !== "string" ||
        typeof parsed["refreshToken"] !== "string" ||
        typeof parsed["expiresAt"] !== "number" ||
        typeof user !== "object" ||
        user === null ||
        typeof (user as Record<string, unknown>)["id"] !== "string"
      ) {
        return undefined;
      }
      const userRecord = user as Record<string, unknown>;
      const authMethod =
        parsed["authMethod"] === "api_key"
          ? "api_key"
          : parsed["accessToken"].startsWith("bgk_")
            ? "api_key"
            : "jwt";
      return {
        serverUrl: parsed["serverUrl"],
        accessToken: parsed["accessToken"],
        refreshToken: parsed["refreshToken"],
        expiresAt: parsed["expiresAt"],
        authMethod,
        user: {
          id: userRecord["id"] as string,
          email: typeof userRecord["email"] === "string" ? userRecord["email"] : null,
          ...(typeof userRecord["workspaceId"] === "string"
            ? { workspaceId: userRecord["workspaceId"] }
            : {}),
          ...(typeof userRecord["apiKeyId"] === "string"
            ? { apiKeyId: userRecord["apiKeyId"] }
            : {}),
        },
      };
    } catch {
      return undefined;
    }
  }
}
