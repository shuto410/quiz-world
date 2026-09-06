/**
 * Reading and displaying the points a host awards when judging.
 *
 * The judgement form holds its number as text, because a partially typed value such as `-`
 * is a normal state for an input to be in and coercing it to a number too early turns it
 * into `0`. Parsing happens once, when the host confirms, and delegates the actual rule to
 * the shared `validateScoreDelta` so that the form and the server agree on both the range
 * and the wording of the refusal.
 */

import type { ValidationResult } from '@quiz-world/shared';
import { validateScoreDelta } from '@quiz-world/shared';

/** Turns the raw field text into the number the server will be sent. */
export function parseScoreDelta(text: string): ValidationResult<number> {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, message: '得点を入力してください' };
  }

  return validateScoreDelta(Number(trimmed));
}

/**
 * Formats a score change for display, always showing its direction.
 *
 * Zero is written as `±0` rather than `0`, so that "judged, no points" cannot be mistaken
 * for a missing value on the result screen.
 */
export function formatScoreDelta(scoreDelta: number): string {
  if (scoreDelta > 0) {
    return `+${scoreDelta}`;
  }
  if (scoreDelta < 0) {
    return `${scoreDelta}`;
  }
  return '±0';
}
