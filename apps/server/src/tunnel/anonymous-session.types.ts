/**
 * Persisted anonymous tunnel session (ephemeral CLI ownership).
 */
export interface AnonymousSession {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
}

/**
 * Result of minting a new anonymous session (plaintext token returned once).
 */
export interface CreatedAnonymousSession {
  readonly session: AnonymousSession;
  /** Opaque bearer for `X-Anonymous-Session` — never stored in plaintext. */
  readonly token: string;
}
