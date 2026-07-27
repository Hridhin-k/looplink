import { createRequire } from "node:module";
import { APP_DISPLAY_NAME, APP_NAME } from "@hridhin-k/badger-shared";

const require = createRequire(import.meta.url);

/**
 * Static configuration that describes the Badger CLI binary.
 */
export interface CliConfig {
  /** Machine-readable binary name, e.g. `badger`. */
  readonly name: string;
  /** Human-readable product name, e.g. `Badger`. */
  readonly displayName: string;
  /** One-line description shown in `--help`. */
  readonly description: string;
  /** Semver string reported by `--version`. */
  readonly version: string;
}

/**
 * Loads CLI metadata from the package manifest and shared constants.
 *
 * @returns Immutable CLI configuration.
 */
export function loadCliConfig(): CliConfig {
  const packageJson = require("../../package.json") as { version: string };

  return {
    name: APP_NAME,
    displayName: APP_DISPLAY_NAME,
    description: "Expose localhost through a secure public URL.",
    version: packageJson.version,
  };
}
