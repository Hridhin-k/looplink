import { randomBytes } from "node:crypto";

import {
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import {
  ANONYMOUS_SESSION_REPOSITORY,
  type AnonymousSessionRepository,
} from "./anonymous-session.repository.js";
import { hashAnonymousSessionToken } from "./anonymous-session-token.js";
import type {
  AnonymousSession,
  CreatedAnonymousSession,
} from "./anonymous-session.types.js";

/** Default anonymous session lifetime (24 hours). */
export const ANONYMOUS_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const ANONYMOUS_TOKEN_PREFIX = "bga_";

/**
 * Mints and validates ephemeral anonymous sessions for unauthenticated tunnels.
 *
 * Intentionally separate from AuthModule — this is tunnel ownership, not login.
 */
@Injectable()
export class AnonymousSessionService {
  constructor(
    @Inject(ANONYMOUS_SESSION_REPOSITORY)
    private readonly sessions: AnonymousSessionRepository,
  ) {}

  /**
   * Creates a new anonymous session and returns the plaintext token once.
   */
  async create(ttlMs: number = ANONYMOUS_SESSION_TTL_MS): Promise<CreatedAnonymousSession> {
    await this.sessions.deleteExpired(new Date().toISOString());

    const token = `${ANONYMOUS_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const session = await this.sessions.create({
      sessionTokenHash: hashAnonymousSessionToken(token),
      expiresAt,
    });

    return { session, token };
  }

  /**
   * Validates a plaintext token and touches `last_seen_at`.
   */
  async validate(token: string): Promise<AnonymousSession> {
    const normalized = token.trim();
    if (normalized.length === 0 || !normalized.startsWith(ANONYMOUS_TOKEN_PREFIX)) {
      throw new UnauthorizedException("Invalid anonymous session.");
    }

    const session = await this.sessions.findByTokenHash(hashAnonymousSessionToken(normalized));
    if (session === undefined) {
      throw new UnauthorizedException("Anonymous session not found.");
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      await this.sessions.deleteById(session.id);
      throw new UnauthorizedException("Anonymous session expired.");
    }

    const touched = await this.sessions.touch(session.id, new Date().toISOString());
    return touched ?? session;
  }

  /**
   * Destroys a session by plaintext token (CLI shutdown).
   */
  async destroyByToken(token: string): Promise<void> {
    const normalized = token.trim();
    if (normalized.length === 0) {
      return;
    }
    await this.sessions.deleteByTokenHash(hashAnonymousSessionToken(normalized));
  }

  /**
   * Detects anonymous session tokens by prefix.
   */
  isAnonymousToken(token: string): boolean {
    return token.trim().startsWith(ANONYMOUS_TOKEN_PREFIX);
  }
}
