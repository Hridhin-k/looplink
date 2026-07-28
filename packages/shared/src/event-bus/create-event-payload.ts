import { randomUUID } from "node:crypto";

import type { BadgerEventBase } from "./badger-events.js";

/**
 * Domain fields supplied by a publisher before stamping base metadata.
 *
 * @typeParam TFields - Event-specific readonly fields (excluding base metadata).
 */
export type EventPayloadInput<TFields extends object> = TFields & {
  /** Optional override; generated when omitted. */
  readonly eventId?: string;
  /** Optional override; `Date.now()` when omitted. */
  readonly occurredAt?: number;
  /** Correlation id for the flow; `undefined` when not applicable. */
  readonly correlationId?: string;
};

/**
 * Builds an immutable event payload with {@link BadgerEventBase} fields.
 *
 * @typeParam TFields - Event-specific fields to merge into the result.
 * @param fields - Domain fields plus optional base overrides.
 * @returns A frozen payload including `eventId`, `occurredAt`, and `correlationId`.
 */
export function createEventPayload<TFields extends object>(
  fields: EventPayloadInput<TFields>,
): Readonly<TFields & BadgerEventBase> {
  const eventId = fields.eventId ?? randomUUID();
  const occurredAt = fields.occurredAt ?? Date.now();
  const correlationId = fields.correlationId;

  const domain = { ...fields } as Record<string, unknown>;
  delete domain["eventId"];
  delete domain["occurredAt"];
  delete domain["correlationId"];

  const payload = {
    ...(domain as TFields),
    eventId,
    occurredAt,
    correlationId,
  } as TFields & BadgerEventBase;

  return Object.freeze(payload);
}
