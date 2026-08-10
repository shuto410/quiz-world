/**
 * Narrowing helpers for values that arrive as `unknown`.
 *
 * Two places take data the type system cannot vouch for: request bodies parsed from JSON,
 * and items read back from DynamoDB. Both start by asking the same question, so they ask it
 * through one predicate rather than each writing its own slightly different version.
 */

/** Arrays are excluded: a JSON array is never a valid body or item. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
