import type { HttpBodyEncoding } from "@hridhin-k/badger-shared";

/** Default body chunk size when streaming over the WebSocket protocol. */
export const DEFAULT_BODY_CHUNK_SIZE = 64 * 1024;

/**
 * Encodes raw bytes for an HTTP body chunk frame.
 *
 * Always uses base64 so binary payloads remain JSON-safe.
 *
 * @param bytes - Raw body bytes.
 * @returns Encoding tag and encoded payload string.
 */
export function encodeBodyChunk(bytes: Uint8Array): {
  encoding: HttpBodyEncoding;
  data: string;
} {
  return {
    encoding: "base64",
    data: Buffer.from(bytes).toString("base64"),
  };
}

/**
 * Decodes an HTTP body chunk frame into raw bytes.
 *
 * @param encoding - Wire encoding.
 * @param data - Encoded payload.
 * @returns Decoded bytes.
 */
export function decodeBodyChunk(encoding: HttpBodyEncoding, data: string): Uint8Array {
  if (encoding === "utf8") {
    return Buffer.from(data, "utf8");
  }

  return Buffer.from(data, "base64");
}

/**
 * Splits a byte buffer into fixed-size chunks.
 *
 * @param bytes - Full payload.
 * @param chunkSize - Maximum chunk length.
 * @returns Array of chunk views.
 */
export function splitBytes(
  bytes: Uint8Array,
  chunkSize: number = DEFAULT_BODY_CHUNK_SIZE,
): Uint8Array[] {
  if (bytes.byteLength === 0) {
    return [];
  }

  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }

  return chunks;
}
