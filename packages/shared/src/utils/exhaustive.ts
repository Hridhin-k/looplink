/**
 * Fails at compile time when a discriminated union is handled non-exhaustively,
 * and throws at runtime if an unexpected member reaches it anyway.
 *
 * @param value - Value the compiler has narrowed to `never`.
 * @throws Error Always, since reaching this function means the union grew.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`);
}
