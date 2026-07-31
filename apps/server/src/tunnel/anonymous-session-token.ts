import { createHash } from "node:crypto";

/**
 * Hashes a plaintext anonymous session token for storage / lookup.
 */
export function hashAnonymousSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
