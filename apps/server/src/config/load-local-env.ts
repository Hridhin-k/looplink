import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Env files considered for local server configuration, in precedence order.
 *
 * Earlier files win for a given key. Existing `process.env` values always win.
 */
const ENV_FILE_NAMES = [".env.local", ".env"] as const;

/**
 * Applies a single dotenv-style file into `process.env`.
 *
 * Does not overwrite keys that are already set (shell / platform wins).
 *
 * @param filePath - Absolute path to the env file.
 * @returns `true` when the file existed and was read.
 */
function applyEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    if (key.length === 0) {
      continue;
    }

    // Shell / hosting env always takes precedence over file values.
    if (process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }

  return true;
}

/**
 * Loads `.env.local` then `.env` from the process working directory.
 *
 * Safe to call when files are missing. Intended for local development; production
 * should inject env via the host (Railway, Docker, etc.).
 */
export function loadLocalEnv(): void {
  const cwd = process.cwd();
  for (const name of ENV_FILE_NAMES) {
    applyEnvFile(resolve(cwd, name));
  }
}
