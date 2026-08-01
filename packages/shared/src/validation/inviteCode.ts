/**
 * Generation, normalisation and validation of tournament invite codes.
 *
 * An invite code is a convenience, not a credential. It only tells the server which
 * tournament someone is trying to reach; whether they may actually join is re-checked
 * against the tournament's status and capacity when they join. That is why an eight
 * character code is enough, and why nothing here needs to be constant-time.
 *
 * The alphabet is chosen so that a code can be read aloud over voice chat and typed back
 * without ambiguity. Digits `0` and `1` and letters `I` and `O` are left out, which leaves
 * exactly 32 characters. That count is not a coincidence: 256 is divisible by 32, so mapping
 * a random byte with a plain modulo produces a uniform distribution with no rejection loop.
 */

import type { ValidationResult } from '../types/validation';

/** Number of characters in a generated invite code. */
export const INVITE_CODE_LENGTH = 8;

/** Upper-case characters an invite code can be built from, minus the ambiguous ones. */
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Source of random bytes.
 *
 * Passed in rather than read from a global, for the same reason the domain layer takes its
 * clock as an argument: it keeps this package free of runtime-specific APIs, and it lets
 * tests drive generation deterministically. The server supplies one backed by `node:crypto`.
 */
export type RandomBytes = (byteLength: number) => Uint8Array;

/** The alphabet contains no regular expression metacharacters, so it can be inlined safely. */
const INVITE_CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/**
 * Generates one invite code.
 *
 * Uniqueness is not this function's job. The caller checks the generated code against the
 * `inviteCode-index` and calls again on the rare collision.
 */
export function generateInviteCode(randomBytes: RandomBytes): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);

  if (bytes.length !== INVITE_CODE_LENGTH) {
    throw new Error(`random source returned ${bytes.length} bytes, expected ${INVITE_CODE_LENGTH}`);
  }

  let code = '';
  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET.charAt(byte % INVITE_CODE_ALPHABET.length);
  }
  return code;
}

/**
 * Puts a code into the form used for storage and lookup.
 *
 * Codes are compared case-insensitively, so both the value written to DynamoDB and the value
 * a query is built from must go through this first.
 */
export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Validates a code typed by a participant and returns it normalised.
 *
 * A single message covers every way a code can be wrong. Telling someone that their code has
 * the right length but an invalid character helps nobody, and the fix is the same either
 * way: look at the invitation again.
 */
export function validateInviteCode(value: unknown): ValidationResult<string> {
  const message = `招待コードは${INVITE_CODE_LENGTH}文字の英数字です`;

  if (typeof value !== 'string') {
    return { ok: false, message };
  }

  const normalized = normalizeInviteCode(value);

  if (!INVITE_CODE_PATTERN.test(normalized)) {
    return { ok: false, message };
  }

  return { ok: true, value: normalized };
}
