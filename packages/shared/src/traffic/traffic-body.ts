import { Buffer } from "node:buffer";

import { DEFAULT_MAX_RECORDED_BODY_BYTES } from "./constants.js";

/**
 * JSON-serializable HTTP body snapshot for events and storage.
 *
 * Bodies are base64-encoded so {@link import("../storage/storage-provider.js").StorageProvider}
 * backends (and future SQLite / Postgres / S3) can persist them without binary
 * serializers. Oversized payloads are truncated; {@link byteLength} always
 * reflects the original size before truncation.
 */
export interface TrafficBody {
  /** Original body size in bytes before truncation. */
  readonly byteLength: number;
  /** `true` when {@link dataBase64} holds fewer bytes than {@link byteLength}. */
  readonly truncated: boolean;
  /** Base64-encoded body bytes (possibly truncated). */
  readonly dataBase64: string;
}

/**
 * Empty body snapshot shared by pending / missing sides of an exchange.
 */
export const EMPTY_TRAFFIC_BODY: TrafficBody = Object.freeze({
  byteLength: 0,
  truncated: false,
  dataBase64: "",
});

/**
 * Builds a {@link TrafficBody} from raw bytes, truncating to `maxBytes`.
 *
 * @param input - Raw body bytes, UTF-8 string, or `undefined` / empty.
 * @param maxBytes - Inclusive maximum retained bytes (default 64 KiB).
 * @returns A serializable body snapshot.
 */
export function createTrafficBody(
  input: Uint8Array | string | undefined,
  maxBytes: number = DEFAULT_MAX_RECORDED_BODY_BYTES,
): TrafficBody {
  if (maxBytes < 0 || !Number.isInteger(maxBytes)) {
    throw new Error(`maxBytes must be a non-negative integer, received ${String(maxBytes)}.`);
  }

  const bytes = toUint8Array(input);
  if (bytes.byteLength === 0) {
    return EMPTY_TRAFFIC_BODY;
  }

  const truncated = bytes.byteLength > maxBytes;
  const retained = truncated ? bytes.subarray(0, maxBytes) : bytes;

  return {
    byteLength: bytes.byteLength,
    truncated,
    dataBase64: Buffer.from(retained).toString("base64"),
  };
}

/**
 * Decodes a {@link TrafficBody} back to bytes (truncated content when flagged).
 *
 * @param body - Stored body snapshot.
 * @returns Decoded byte array.
 */
export function trafficBodyToBytes(body: TrafficBody): Uint8Array {
  if (body.dataBase64.length === 0) {
    return new Uint8Array();
  }

  return new Uint8Array(Buffer.from(body.dataBase64, "base64"));
}

/**
 * Re-applies the body size cap to an existing snapshot (defense in depth).
 *
 * @param body - Incoming body (for example from an EventBus payload).
 * @param maxBytes - Inclusive maximum retained bytes.
 * @returns A body that respects `maxBytes`.
 */
export function capTrafficBody(body: TrafficBody, maxBytes: number): TrafficBody {
  if (body.dataBase64.length === 0 && body.byteLength === 0) {
    return EMPTY_TRAFFIC_BODY;
  }

  const bytes = trafficBodyToBytes(body);
  const capped = createTrafficBody(bytes, maxBytes);

  return {
    byteLength: body.byteLength,
    truncated: body.truncated || capped.truncated || body.byteLength > maxBytes,
    dataBase64: capped.dataBase64,
  };
}

/**
 * Converts supported input shapes to a Uint8Array.
 *
 * @param input - Raw body input.
 * @returns Byte view (may share the underlying buffer for Uint8Array input).
 */
function toUint8Array(input: Uint8Array | string | undefined): Uint8Array {
  if (input === undefined) {
    return new Uint8Array();
  }

  if (typeof input === "string") {
    return new Uint8Array(Buffer.from(input, "utf8"));
  }

  return input;
}
