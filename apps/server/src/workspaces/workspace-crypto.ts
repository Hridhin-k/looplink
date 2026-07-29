import { createHash, randomBytes } from "node:crypto";

/**
 * SHA-256 hex digest used for invitation tokens and API keys.
 * Plaintext secrets are never persisted.
 */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Cryptographically random URL-safe token for invitations.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

const API_KEY_PREFIX = "bgk_";

/**
 * Generates a workspace API key.
 *
 * Format: `bgk_<8 hex prefix><40 hex secret>` (plaintext returned once).
 * Only `keyPrefix` and `keyHash` are stored.
 */
export function generateApiKeyMaterial(): {
  readonly plaintext: string;
  readonly keyPrefix: string;
  readonly keyHash: string;
} {
  const prefixBody = randomBytes(4).toString("hex");
  const secret = randomBytes(20).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${prefixBody}${secret}`;
  return {
    plaintext,
    keyPrefix: `${API_KEY_PREFIX}${prefixBody}`,
    keyHash: hashSecret(plaintext),
  };
}

/**
 * Detects Badger workspace API keys by prefix.
 */
export function isApiKeyToken(token: string): boolean {
  return token.trim().startsWith(API_KEY_PREFIX);
}
