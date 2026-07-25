/**
 * Successful branch of a {@link Result}.
 *
 * @typeParam TValue - Type of the produced value.
 */
export interface Success<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

/**
 * Failed branch of a {@link Result}.
 *
 * @typeParam TError - Type describing the failure.
 */
export interface Failure<TError> {
  readonly ok: false;
  readonly error: TError;
}

/**
 * Discriminated union describing an operation that either produced a value or
 * failed, letting callers handle failure without exceptions and without losing
 * type information about the error.
 *
 * @typeParam TValue - Type of the value produced on success.
 * @typeParam TError - Type describing the failure. Defaults to `Error`.
 */
export type Result<TValue, TError = Error> = Success<TValue> | Failure<TError>;
