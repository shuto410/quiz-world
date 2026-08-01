/**
 * The result shape every validator in this package returns.
 *
 * Validators return a value rather than throwing, because both sides of the wire call them
 * for different reasons: the client to decide whether to enable a submit button, the server
 * to decide whether to answer with `VALIDATION_ERROR`. Exceptions would be the wrong tool
 * for the client's case.
 *
 * The success case carries the normalised value, not the input. Callers are expected to
 * store what came back, so that trimming happens exactly once and in one place.
 */

/** Accepted input, together with the normalised value the caller should use. */
export type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

/**
 * Rejected input.
 *
 * `message` is Japanese copy meant to be shown as-is, either next to a form field or in the
 * `message` of an `ApiErrorResponse` or `SocketErrorEvent`. Keeping the wording here rather
 * than at each call site means the client and the server explain a rejection identically.
 */
export type ValidationFailure = {
  ok: false;
  message: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;
