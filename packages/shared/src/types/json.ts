/**
 * Scalar values representable in JSON.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON array of arbitrary depth.
 */
export type JsonArray = readonly JsonValue[];

/**
 * JSON object of arbitrary depth.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * Any value that survives a `JSON.stringify` / `JSON.parse` round trip.
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
