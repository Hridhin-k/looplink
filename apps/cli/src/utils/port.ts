import { err, ok, type Result } from "@badger/shared";

/** Inclusive lower bound of a valid TCP port. */
const MIN_PORT = 1;

/** Inclusive upper bound of a valid TCP port. */
const MAX_PORT = 65_535;

/**
 * Parses and validates a TCP port from a CLI argument.
 *
 * Accepts only base-10 integers in the range 1–65535. Leading zeros are
 * allowed (`08080` → `8080`); floats, signs, and non-numeric text are rejected.
 *
 * @param input - Raw argument string from the command line.
 * @returns A successful result with the port number, or a failed result with a
 *   human-readable error message.
 */
export function parsePort(input: string): Result<number, string> {
  const trimmed = input.trim();

  if (trimmed.length === 0 || !/^\d+$/.test(trimmed)) {
    return err(
      `Invalid port "${input}": expected an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
    );
  }

  const port = Number(trimmed);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    return err(
      `Invalid port ${trimmed}: must be between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
    );
  }

  return ok(port);
}
