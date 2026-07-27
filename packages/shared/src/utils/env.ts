/**
 * Resolves an environment value preferring a Badger variable over a LoopLink alias.
 *
 * Precedence: `preferredName` (non-empty) → `legacyName` (non-empty) → `undefined`.
 * When only the legacy variable is set, a deprecation warning is emitted.
 *
 * @param preferredName - Canonical Badger env var (for example `BADGER_PUBLIC_BASE_DOMAIN`).
 * @param legacyName - Deprecated LoopLink env var (for example `LOOPLINK_PUBLIC_BASE_DOMAIN`).
 * @param options - Optional warning sink (defaults to `console.warn`).
 * @returns Trimmed value, or `undefined` when neither variable is set.
 */
export function resolveEnvPreferringBadger(
  preferredName: string,
  legacyName: string,
  options?: {
    readonly warn?: (message: string) => void;
  },
): string | undefined {
  const preferred = process.env[preferredName];
  if (preferred !== undefined && preferred.trim().length > 0) {
    return preferred.trim();
  }

  const legacy = process.env[legacyName];
  if (legacy !== undefined && legacy.trim().length > 0) {
    const warn =
      options?.warn ??
      ((message: string): void => {
        console.warn(message);
      });
    warn(
      `[badger] ${legacyName} is deprecated; use ${preferredName} instead. Support will be removed in a future major release.`,
    );
    return legacy.trim();
  }

  return undefined;
}
