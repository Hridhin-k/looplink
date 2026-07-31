import { createClient, type Provider } from "@supabase/supabase-js";
import { createServer } from "node:http";

import type { CliAuthSession } from "./cli-auth-api-client.js";
import { openBrowser } from "../utils/open-browser.js";

interface OAuthResult {
  readonly session: CliAuthSession;
}

export async function runCliOAuthLogin(config: {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly provider: string;
}): Promise<OAuthResult> {
  const storage = createMemoryStorage();
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage,
    },
  });

  const callback = await listenForOAuthCallback();

  const { data, error } = await client.auth.signInWithOAuth({
    provider: config.provider as Provider,
    options: {
      redirectTo: callback.redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error !== null) {
    callback.close();
    throw new Error(error.message);
  }

  await openBrowser(data.url);

  const code = await callback.waitForCode();
  callback.close();

  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error !== null) {
    throw new Error(exchanged.error.message);
  }

  const session = exchanged.data.session;
  return {
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: exchanged.data.user.id,
        email: exchanged.data.user.email ?? null,
      },
    },
  };
}

function createMemoryStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  const map = new Map<string, string>();
  return {
    getItem: (key: string): string | null => map.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      map.set(key, value);
    },
    removeItem: (key: string): void => {
      map.delete(key);
    },
  };
}

async function listenForOAuthCallback(): Promise<{
  readonly redirectUrl: string;
  readonly waitForCode: () => Promise<string>;
  readonly close: () => void;
}> {
  let resolver: ((code: string) => void) | undefined;
  let rejecter: ((error: Error) => void) | undefined;

  const waitForCode = new Promise<string>((resolve, reject) => {
    resolver = resolve;
    rejecter = reject;
  });

  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/callback") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const code = requestUrl.searchParams.get("code");
    if (code === null || code.trim().length === 0) {
      const oauthError =
        requestUrl.searchParams.get("error_description") ??
        requestUrl.searchParams.get("error") ??
        "OAuth callback missing code.";
      res.statusCode = 400;
      res.end("Login failed.");
      rejecter?.(new Error(oauthError.replaceAll("+", " ")));
      return;
    }

    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end("<html><body><p>Badger CLI login complete. You can close this tab.</p></body></html>");
    resolver?.(code);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
    server.on("error", (error) => {
      reject(error);
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Failed to bind local OAuth callback server.");
  }

  return {
    redirectUrl: `http://127.0.0.1:${String(address.port)}/callback`,
    waitForCode: () => waitForCode,
    close: () => {
      server.close();
    },
  };
}
