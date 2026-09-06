/**
 * Field-level validation of everything a user types.
 *
 * The same functions run on both sides: the client uses them to show an error next to the
 * input, the server uses them to decide whether to reject the request. The server's answer
 * is the binding one, so the client calling them first is a convenience, never a substitute.
 *
 * Two conventions apply to every text field here:
 *
 * - The value is trimmed and the trimmed form is what gets returned and stored. Length is
 *   measured after trimming, so a name padded with spaces cannot exceed the limit.
 * - Control characters are rejected. Every one of these fields is a single-line input that
 *   ends up in a list or a chat-like line, and a newline smuggled into a display name breaks
 *   that layout for everyone in the room. Zero-width characters are deliberately not
 *   rejected, because filtering them would also break emoji sequences.
 *
 * Rules that need to look at the rest of the room, such as rejecting a display name that
 * someone else already took, are not here; they belong to the server, which is the only
 * place that knows the room's contents.
 */

import type { ValidationResult } from '../types/validation';

/**
 * Limits shared by the form inputs and the validators.
 *
 * Exported so that a form can set `maxLength` from the same number the validator enforces,
 * instead of repeating it in the markup.
 */
export const INPUT_CONSTRAINTS = {
  tournamentName: { maxLength: 50 },
  displayName: { maxLength: 20 },
  answerText: { maxLength: 200 },
  maxParticipants: { min: 2, max: 50 },
  scoreDelta: { min: -999, max: 999 },
} as const;

/** C0 and C1 control characters, which includes newlines and tabs. */
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

type TextFieldSpec = {
  /** Japanese noun used to build the error copy, for example 大会名. */
  label: string;
  maxLength: number;
};

function validateText(value: unknown, spec: TextFieldSpec): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, message: `${spec.label}を入力してください` };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: false, message: `${spec.label}を入力してください` };
  }

  if (trimmed.length > spec.maxLength) {
    return {
      ok: false,
      message: `${spec.label}は${spec.maxLength}文字以内で入力してください`,
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    return { ok: false, message: `${spec.label}に改行や制御文字は使えません` };
  }

  return { ok: true, value: trimmed };
}

/** Validates the tournament name entered on the creation screen. */
export function validateTournamentName(value: unknown): ValidationResult<string> {
  return validateText(value, {
    label: '大会名',
    maxLength: INPUT_CONSTRAINTS.tournamentName.maxLength,
  });
}

/**
 * Validates a participant's display name, used both when joining and when renaming.
 *
 * Uniqueness within the room is checked separately by the server.
 */
export function validateDisplayName(value: unknown): ValidationResult<string> {
  return validateText(value, {
    label: '表示名',
    maxLength: INPUT_CONSTRAINTS.displayName.maxLength,
  });
}

/** Validates a written answer sent by the participant holding the answer right. */
export function validateAnswerText(value: unknown): ValidationResult<string> {
  return validateText(value, {
    label: '回答',
    maxLength: INPUT_CONSTRAINTS.answerText.maxLength,
  });
}

/**
 * Validates the capacity chosen when creating a tournament.
 *
 * Numeric strings are rejected rather than coerced: a form that sends `"10"` has a bug the
 * server should not paper over.
 */
export function validateMaxParticipants(value: unknown): ValidationResult<number> {
  const { min, max } = INPUT_CONSTRAINTS.maxParticipants;
  const message = `最大参加人数は${min}〜${max}の整数で入力してください`;

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, message };
  }

  if (value < min || value > max) {
    return { ok: false, message };
  }

  return { ok: true, value };
}

/**
 * Validates the points the host awards when judging an answer.
 *
 * Zero and negative values are ordinary: the host may award nothing for a correct answer, or
 * deduct for a wrong one. The bounds are a safeguard rather than a game rule. Scores are only
 * ever added to, so a `NaN` or a mistyped digit would stay in the standings for the rest of
 * the tournament with no operation to undo it.
 */
export function validateScoreDelta(value: unknown): ValidationResult<number> {
  const { min, max } = INPUT_CONSTRAINTS.scoreDelta;
  const message = `得点は${min}〜${max}の整数で入力してください`;

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, message };
  }

  if (value < min || value > max) {
    return { ok: false, message };
  }

  return { ok: true, value };
}
