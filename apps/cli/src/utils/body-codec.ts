import type { HttpBodyEncoding } from "@looplink/shared";

/** Body chunk size when streaming over the WebSocket protocol. */
export const BODY_CHUNK_SIZE = 64 * 1024;

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
export function splitBytes(bytes: Uint8Array, chunkSize: number = BODY_CHUNK_SIZE): Uint8Array[] {
  if (bytes.byteLength === 0) {
    return [];
  }

  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }

  return chunks;
}

/**
 * Concatenates body chunks into a single buffer.
 *
 * @param chunks - Ordered decoded chunks.
 * @returns The full payload, or `undefined` when there are no bytes.
 */
export function concatChunks(chunks: readonly Uint8Array[]): Uint8Array | undefined {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  if (total === 0) {
    return undefined;
  }

  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
