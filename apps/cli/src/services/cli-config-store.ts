import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * User-editable CLI preferences (interactive `badger config`).
 */
export interface CliUserConfig {
  readonly autoCopyUrl: boolean;
  readonly autoOpenBrowser: boolean;
  readonly showQrCode: boolean;
  readonly animations: boolean;
  readonly telemetry: boolean;
  readonly dashboardUrl: string;
  /** Empty string means “use built-in / env default”. */
  readonly serverUrl: string;
}

const DEFAULTS: CliUserConfig = {
  autoCopyUrl: true,
  autoOpenBrowser: true,
  showQrCode: true,
  animations: true,
  telemetry: false,
  dashboardUrl: "http://localhost:3000",
  serverUrl: "",
};

/**
 * Persists CLI UX preferences under `~/.config/badger/config.json`.
 */
export class CliConfigStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = join(homedir(), ".config", "badger", "config.json");
  }

  load(): CliUserConfig {
    const stored = this.read();
    if (stored === undefined) {
      return { ...DEFAULTS };
    }
    return {
      autoCopyUrl: stored.autoCopyUrl ?? DEFAULTS.autoCopyUrl,
      autoOpenBrowser: stored.autoOpenBrowser ?? DEFAULTS.autoOpenBrowser,
      showQrCode: stored.showQrCode ?? DEFAULTS.showQrCode,
      animations: stored.animations ?? DEFAULTS.animations,
      telemetry: stored.telemetry ?? DEFAULTS.telemetry,
      dashboardUrl:
        typeof stored.dashboardUrl === "string" && stored.dashboardUrl.trim().length > 0
          ? stored.dashboardUrl.trim()
          : DEFAULTS.dashboardUrl,
      serverUrl:
        typeof stored.serverUrl === "string" && stored.serverUrl.trim().length > 0
          ? stored.serverUrl.trim()
          : DEFAULTS.serverUrl,
    };
  }

  save(patch: Partial<CliUserConfig>): CliUserConfig {
    const next: CliUserConfig = { ...this.load(), ...patch };
    const parent = dirname(this.filePath);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true, mode: 0o700 });
    }
    writeFileSync(this.filePath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    chmodSync(this.filePath, 0o600);
    return next;
  }

  private read(): Partial<CliUserConfig> | undefined {
    try {
      if (!existsSync(this.filePath)) {
        return undefined;
      }
      const raw = readFileSync(this.filePath, "utf8").trim();
      if (raw.length === 0) {
        return undefined;
      }
      return JSON.parse(raw) as Partial<CliUserConfig>;
    } catch {
      return undefined;
    }
  }
}
