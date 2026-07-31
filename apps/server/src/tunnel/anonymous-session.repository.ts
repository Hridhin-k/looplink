import type { AnonymousSession } from "./anonymous-session.types.js";

export const ANONYMOUS_SESSION_REPOSITORY = Symbol("ANONYMOUS_SESSION_REPOSITORY");

export interface CreateAnonymousSessionRecordInput {
  readonly sessionTokenHash: string;
  readonly expiresAt: string;
}

/**
 * Persistence port for anonymous tunnel sessions.
 */
export interface AnonymousSessionRepository {
  create(input: CreateAnonymousSessionRecordInput): Promise<AnonymousSession>;
  findByTokenHash(sessionTokenHash: string): Promise<AnonymousSession | undefined>;
  touch(id: string, lastSeenAt: string): Promise<AnonymousSession | undefined>;
  deleteById(id: string): Promise<boolean>;
  deleteByTokenHash(sessionTokenHash: string): Promise<boolean>;
  deleteExpired(nowIso: string): Promise<number>;
}
