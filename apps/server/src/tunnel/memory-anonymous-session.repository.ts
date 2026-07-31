import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type {
  AnonymousSessionRepository,
  CreateAnonymousSessionRecordInput,
} from "./anonymous-session.repository.js";
import type { AnonymousSession } from "./anonymous-session.types.js";

interface MemoryAnonymousSessionRecord extends AnonymousSession {
  readonly sessionTokenHash: string;
}

/**
 * In-memory anonymous session store (used when Supabase is not configured).
 */
@Injectable()
export class MemoryAnonymousSessionRepository implements AnonymousSessionRepository {
  private readonly byId = new Map<string, MemoryAnonymousSessionRecord>();
  private readonly byTokenHash = new Map<string, string>();

  async create(input: CreateAnonymousSessionRecordInput): Promise<AnonymousSession> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const record: MemoryAnonymousSessionRecord = {
      id,
      sessionTokenHash: input.sessionTokenHash,
      createdAt: now,
      expiresAt: input.expiresAt,
      lastSeenAt: now,
    };
    this.byId.set(id, record);
    this.byTokenHash.set(input.sessionTokenHash, id);
    return toPublic(record);
  }

  async findByTokenHash(sessionTokenHash: string): Promise<AnonymousSession | undefined> {
    const id = this.byTokenHash.get(sessionTokenHash);
    if (id === undefined) {
      return undefined;
    }
    const record = this.byId.get(id);
    return record === undefined ? undefined : toPublic(record);
  }

  async touch(id: string, lastSeenAt: string): Promise<AnonymousSession | undefined> {
    const existing = this.byId.get(id);
    if (existing === undefined) {
      return undefined;
    }
    const updated: MemoryAnonymousSessionRecord = {
      ...existing,
      lastSeenAt,
    };
    this.byId.set(id, updated);
    return toPublic(updated);
  }

  async deleteById(id: string): Promise<boolean> {
    const existing = this.byId.get(id);
    if (existing === undefined) {
      return false;
    }
    this.byId.delete(id);
    this.byTokenHash.delete(existing.sessionTokenHash);
    return true;
  }

  async deleteByTokenHash(sessionTokenHash: string): Promise<boolean> {
    const id = this.byTokenHash.get(sessionTokenHash);
    if (id === undefined) {
      return false;
    }
    return this.deleteById(id);
  }

  async deleteExpired(nowIso: string): Promise<number> {
    let removed = 0;
    for (const [id, record] of this.byId) {
      if (record.expiresAt <= nowIso) {
        this.byId.delete(id);
        this.byTokenHash.delete(record.sessionTokenHash);
        removed += 1;
      }
    }
    return removed;
  }
}

function toPublic(record: MemoryAnonymousSessionRecord): AnonymousSession {
  return {
    id: record.id,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastSeenAt: record.lastSeenAt,
  };
}
