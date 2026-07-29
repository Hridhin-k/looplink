import { BadRequestException } from "@nestjs/common";
import { Buffer } from "node:buffer";

/**
 * Parses a Fastify body that may be a raw {@link Buffer} (server-wide catch-all
 * content-type parser) or an already-decoded object.
 *
 * @param body - Nest `@Body()` value.
 * @returns Parsed JSON object.
 */
export function parseJsonBody(body: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(body)) {
    if (body.length === 0) {
      throw new BadRequestException("Request body is required.");
    }
    try {
      const parsed: unknown = JSON.parse(body.toString("utf8"));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new BadRequestException("Request body must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Request body must be valid JSON.");
    }
  }

  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  throw new BadRequestException("Request body must be a JSON object.");
}

/**
 * Reads a required string field from a parsed JSON body.
 *
 * @param body - Parsed object.
 * @param key - Field name.
 * @returns Trimmed string value.
 */
export function readRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") {
    throw new BadRequestException(`${key} is required.`);
  }
  return value;
}
