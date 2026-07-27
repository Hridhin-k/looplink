import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { request } from "undici";

/** Fake public base domain used for tunnel URLs during the suite. */
export const E2E_BASE_DOMAIN = "badger.test";

/** Matches subdomain tunnel URLs printed by the CLI (`BADGER_PUBLIC_URL_MODE=subdomain`). */
export const TUNNEL_URL_PATTERN = new RegExp(
  `https://[a-z0-9]+\\.${E2E_BASE_DOMAIN.replace(".", "\\.")}`,
  "g",
);

/** Matches path-based tunnel URLs (`BADGER_PUBLIC_URL_MODE=path`). */
export const PATH_TUNNEL_URL_PATTERN = new RegExp(
  `https://${E2E_BASE_DOMAIN.replace(".", "\\.")}/tunnel/[a-f0-9]{32}`,
  "g",
);

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SERVER_ENTRY = path.join(REPO_ROOT, "apps", "server", "dist", "main.js");
const CLI_ENTRY = path.join(REPO_ROOT, "apps", "cli", "dist", "index.js");

/**
 * Fails fast with a clear message when the workspaces have not been built.
 */
export function assertWorkspacesBuilt(): void {
  for (const entry of [SERVER_ENTRY, CLI_ENTRY]) {
    if (!existsSync(entry)) {
      throw new Error(
        `Missing build artifact "${entry}". Run \`pnpm build\` before the E2E suite.`,
      );
    }
  }
}

/**
 * A spawned server or CLI process with captured, searchable output.
 */
export class ManagedProcess {
  private buffer = "";
  private hasExited = false;
  private readonly exit: Promise<void>;

  /**
   * @param child - Spawned child process with piped stdio.
   * @param name - Label used in error messages.
   */
  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    readonly name: string,
  ) {
    child.stdout.on("data", (data: Buffer) => {
      this.buffer += data.toString("utf8");
    });
    child.stderr.on("data", (data: Buffer) => {
      this.buffer += data.toString("utf8");
    });
    this.exit = new Promise<void>((resolve) => {
      child.once("exit", () => {
        this.hasExited = true;
        resolve();
      });
    });
  }

  /**
   * @returns Everything the process has written to stdout and stderr so far.
   */
  output(): string {
    return this.buffer;
  }

  /**
   * Polls the captured output until `extract` produces a value.
   *
   * @param extract - Reads the full output and returns a value once satisfied.
   * @param timeoutMs - Give-up deadline.
   * @returns Whatever `extract` returned.
   */
  async waitFor<T>(extract: (output: string) => T | undefined, timeoutMs = 30_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const value = extract(this.buffer);
      if (value !== undefined) {
        return value;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting on ${this.name} output after ${String(timeoutMs)}ms.\n--- ${this.name} output ---\n${this.buffer}`,
        );
      }

      await delay(50);
    }
  }

  /**
   * Waits until the captured output matches a pattern.
   *
   * @param pattern - Regular expression to search for.
   * @param timeoutMs - Give-up deadline.
   * @returns The first match.
   */
  async waitForOutput(pattern: RegExp, timeoutMs = 30_000): Promise<string> {
    return this.waitFor((output) => pattern.exec(output)?.[0] ?? undefined, timeoutMs);
  }

  /**
   * Terminates the process, escalating to SIGKILL if it lingers.
   *
   * @param signal - Initial signal; SIGKILL simulates an abrupt crash.
   */
  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    if (this.hasExited) {
      return;
    }

    this.child.kill(signal);

    const outcome = await Promise.race([
      this.exit.then(() => "exited" as const),
      delay(5_000).then(() => "timeout" as const),
    ]);

    if (outcome === "timeout") {
      this.child.kill("SIGKILL");
      await this.exit;
    }
  }
}

/**
 * Spawns the built Badger server and waits until `/health` responds.
 *
 * Rate limits are raised far beyond the defaults so the suite exercises
 * forwarding rather than the security throttles (covered by unit tests).
 *
 * @param serverPort - HTTP/WebSocket port for the server to bind.
 * @param options - Public URL mode (`subdomain` keeps Host-based E2E stable).
 * @returns Managed process handle.
 */
export async function startServer(
  serverPort: number,
  options: { readonly publicUrlMode?: "path" | "subdomain" } = {},
): Promise<ManagedProcess> {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOST: "127.0.0.1",
      BADGER_PUBLIC_BASE_DOMAIN: E2E_BASE_DOMAIN,
      BADGER_PUBLIC_URL_MODE: options.publicUrlMode ?? "subdomain",
      BADGER_WS_MESSAGE_RATE_LIMIT: "100000",
      BADGER_HTTP_RATE_LIMIT_MAX: "100000",
      NO_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const managed = new ManagedProcess(child, "server");
  await waitForHealth(serverPort, managed);
  return managed;
}

/**
 * Spawns the built CLI pointed at a local server and sample app port.
 *
 * @param appPort - Local port the CLI should expose.
 * @param serverPort - Port of the running Badger server.
 * @returns Managed process handle.
 */
export function startCli(appPort: number, serverPort: number): ManagedProcess {
  const child = spawn(
    process.execPath,
    [CLI_ENTRY, String(appPort), "--server", `ws://127.0.0.1:${String(serverPort)}`],
    {
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return new ManagedProcess(child, "cli");
}

/**
 * Response from a request routed through the public tunnel endpoint.
 */
export interface TunnelResponse {
  /** HTTP status code. */
  readonly statusCode: number;
  /** Response headers as returned by undici. */
  readonly headers: Record<string, string | string[] | undefined>;
  /** Fully buffered response body. */
  readonly body: Buffer;
}

/**
 * Sends an HTTP request through a tunnel's public URL.
 *
 * DNS for the fake base domain does not resolve, so the request targets
 * 127.0.0.1 directly and carries the public hostname in the `Host` header.
 *
 * For path-based URLs (`https://domain/tunnel/{id}`), `requestPath` is appended
 * under that prefix so `/api/data` becomes `/tunnel/{id}/api/data`. For
 * subdomain URLs the path is used as-is (routing is via `Host`).
 *
 * @param serverPort - Badger server port.
 * @param publicUrl - Tunnel URL printed by the CLI.
 * @param requestPath - Application path (with optional query string).
 * @param options - Method, extra headers, and body.
 * @returns Buffered status, headers, and body.
 */
export async function tunnelRequest(
  serverPort: number,
  publicUrl: string,
  requestPath: string,
  options: {
    readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    readonly headers?: Record<string, string>;
    readonly body?: string | Buffer;
  } = {},
): Promise<TunnelResponse> {
  const parsed = new URL(publicUrl);
  const host = parsed.host;
  const targetPath = joinTunnelRequestPath(parsed.pathname, requestPath);

  const response = await request(`http://127.0.0.1:${String(serverPort)}${targetPath}`, {
    method: options.method ?? "GET",
    headers: { ...options.headers, host },
    ...(options.body === undefined ? {} : { body: options.body }),
  });

  const body = Buffer.from(await response.body.arrayBuffer());

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body,
  };
}

/**
 * Joins a public tunnel pathname with an application request path.
 *
 * @param publicPathname - Pathname from the minted public URL (`/` or `/tunnel/{id}`).
 * @param requestPath - Application path, optionally with a query string.
 * @returns Path (+ query) to send to the Badger server.
 */
export function joinTunnelRequestPath(publicPathname: string, requestPath: string): string {
  const queryIndex = requestPath.indexOf("?");
  const pathname = queryIndex === -1 ? requestPath : requestPath.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : requestPath.slice(queryIndex);

  const appPath = pathname.length === 0 || pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedApp = appPath.length === 0 ? "/" : appPath;

  if (!publicPathname.startsWith("/tunnel/")) {
    return `${normalizedApp}${query}`;
  }

  const tunnelBase = publicPathname.replace(/\/$/, "");
  const joined = normalizedApp === "/" ? tunnelBase : `${tunnelBase}${normalizedApp}`;
  return `${joined}${query}`;
}

/**
 * Finds a free TCP port on the loopback interface.
 *
 * @returns An ephemeral port that was free at the time of the check.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine a free port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error === undefined) {
          resolve(port);
        } else {
          reject(error);
        }
      });
    });
  });
}

async function waitForHealth(serverPort: number, managed: ManagedProcess): Promise<void> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      const response = await request(`http://127.0.0.1:${String(serverPort)}/health`);
      const text = await response.body.text();

      if (response.statusCode === 200 && text.includes("ok")) {
        return;
      }
    } catch {
      // Server still booting; retry.
    }

    await delay(100);
  }

  throw new Error(
    `Server did not become healthy on port ${String(serverPort)}.\n--- server output ---\n${managed.output()}`,
  );
}
