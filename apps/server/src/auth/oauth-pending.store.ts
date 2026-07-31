import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE helpers for dashboard OAuth.
 * The code verifier is returned to the browser (standard public-client PKCE).
 */
export function createPkcePair(): {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
} {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}
