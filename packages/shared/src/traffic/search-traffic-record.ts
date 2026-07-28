import { trafficBodyToBytes } from "./traffic-body.js";
import type { TrafficBody } from "./traffic-body.js";
import type { TrafficRecord } from "./traffic-record.js";

/**
 * Searchable fields for full-text traffic search.
 */
export const TRAFFIC_SEARCH_FIELDS = [
  "url",
  "headers",
  "method",
  "body",
  "response",
  "tunnel",
  "status",
  "timestamp",
] as const;

/**
 * Union of {@link TRAFFIC_SEARCH_FIELDS}.
 */
export type TrafficSearchField = (typeof TRAFFIC_SEARCH_FIELDS)[number];

/**
 * Result of matching a single traffic record against a query.
 */
export interface TrafficSearchHit {
  readonly requestId: string;
  readonly fields: readonly TrafficSearchField[];
}

/**
 * Finds which fields of a traffic record contain `query` (case-insensitive).
 *
 * @param record - Full traffic record (bodies included when searching body/response).
 * @param query - User search string.
 * @returns Matching field ids, or `undefined` when nothing matches / query empty.
 */
export function matchTrafficRecordFields(
  record: TrafficRecord,
  query: string,
): readonly TrafficSearchField[] | undefined {
  const normalized = normalizeQuery(query);
  if (normalized === undefined) {
    return undefined;
  }

  const fields: TrafficSearchField[] = [];

  if (includesQuery(record.path, normalized) || includesQuery(record.requestId, normalized)) {
    fields.push("url");
  }
  if (includesQuery(record.method, normalized)) {
    fields.push("method");
  }
  if (includesQuery(record.tunnelId, normalized)) {
    fields.push("tunnel");
  }
  if (
    (record.status !== undefined && includesQuery(String(record.status), normalized)) ||
    (record.error !== undefined && includesQuery(record.error, normalized))
  ) {
    fields.push("status");
  }
  if (timestampMatches(record.timestamp, normalized)) {
    fields.push("timestamp");
  }
  if (headersMatch(record.headers, normalized) || headersMatch(record.query, normalized)) {
    fields.push("headers");
  }
  if (bodyMatches(record.body, normalized)) {
    fields.push("body");
  }
  if (
    headersMatch(record.responseHeaders, normalized) ||
    bodyMatches(record.responseBody, normalized)
  ) {
    fields.push("response");
  }

  return fields.length > 0 ? fields : undefined;
}

/**
 * Filters records to those matching `query`, newest-first order preserved.
 *
 * @param records - Candidate records.
 * @param query - User search string.
 * @returns Hits with matched field lists.
 */
export function searchTrafficRecords(
  records: readonly TrafficRecord[],
  query: string,
): readonly TrafficSearchHit[] {
  const normalized = normalizeQuery(query);
  if (normalized === undefined) {
    return records.map((record) => ({
      requestId: record.requestId,
      fields: [] as const,
    }));
  }

  const hits: TrafficSearchHit[] = [];
  for (const record of records) {
    const fields = matchTrafficRecordFields(record, normalized);
    if (fields !== undefined) {
      hits.push({ requestId: record.requestId, fields });
    }
  }
  return hits;
}

/**
 * @param query - Raw user input.
 * @returns Lowercased trimmed query, or `undefined` when empty.
 */
export function normalizeQuery(query: string): string | undefined {
  const trimmed = query.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function includesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

function headersMatch(headers: Record<string, string | readonly string[]>, query: string): boolean {
  for (const [key, raw] of Object.entries(headers)) {
    if (includesQuery(key, query)) {
      return true;
    }
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (includesQuery(String(value), query)) {
          return true;
        }
      }
    } else if (includesQuery(String(raw), query)) {
      return true;
    }
  }
  return false;
}

function bodyMatches(body: TrafficBody, query: string): boolean {
  if (body.dataBase64.length === 0 || body.byteLength === 0) {
    return false;
  }

  try {
    const bytes = trafficBodyToBytes(body);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return includesQuery(text, query);
  } catch {
    return includesQuery(body.dataBase64, query);
  }
}

function timestampMatches(epochMs: number, query: string): boolean {
  if (includesQuery(String(epochMs), query)) {
    return true;
  }

  try {
    const date = new Date(epochMs);
    return (
      includesQuery(date.toISOString(), query) ||
      includesQuery(date.toUTCString(), query) ||
      includesQuery(date.toLocaleString(), query) ||
      includesQuery(
        new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(date),
        query,
      )
    );
  } catch {
    return false;
  }
}
