import type { Failure, Result, Success } from "../types/result.js";

/**
 * Wraps a value in a successful {@link Result}.
 *
 * @typeParam TValue - Type of the value being wrapped.
 * @param value - Value produced by the operation.
 * @returns A successful result carrying `value`.
 */
export function ok<TValue>(value: TValue): Success<TValue> {
  return { ok: true, value };
}

/**
 * Wraps a failure in a failed {@link Result}.
 *
 * @typeParam TError - Type describing the failure.
 * @param error - Failure produced by the operation.
 * @returns A failed result carrying `error`.
 */
export function err<TError>(error: TError): Failure<TError> {
  return { ok: false, error };
}

/**
 * Narrows a {@link Result} to its successful branch.
 *
 * @param result - Result to inspect.
 * @returns `true` when the result succeeded.
 */
export function isOk<TValue, TError>(result: Result<TValue, TError>): result is Success<TValue> {
  return result.ok;
}

/**
 * Narrows a {@link Result} to its failed branch.
 *
 * @param result - Result to inspect.
 * @returns `true` when the result failed.
 */
export function isErr<TValue, TError>(result: Result<TValue, TError>): result is Failure<TError> {
  return !result.ok;
}

/**
 * Reads the value out of a {@link Result}, substituting a fallback on failure.
 *
 * @param result - Result to read.
 * @param fallback - Value returned when `result` failed.
 * @returns The contained value, otherwise `fallback`.
 */
export function unwrapOr<TValue, TError>(result: Result<TValue, TError>, fallback: TValue): TValue {
  return result.ok ? result.value : fallback;
}
