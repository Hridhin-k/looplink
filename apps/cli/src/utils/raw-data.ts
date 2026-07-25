/**
 * Decodes a `ws` {@link import("ws").RawData} payload into a UTF-8 string.
 *
 * @param data - Raw WebSocket frame payload.
 * @returns UTF-8 text suitable for JSON parsing.
 */
export function rawDataToString(data: string | Buffer | ArrayBuffer | Buffer[]): string {
  if (typeof data === "string") {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}
