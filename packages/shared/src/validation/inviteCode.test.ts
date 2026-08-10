/**
 * Tests for invite code generation, normalisation and validation.
 *
 * Three things are worth pinning down. The alphabet must stay free of characters people
 * confuse when reading a code aloud. The mapping from random bytes must stay uniform, which
 * silently depends on the alphabet having exactly 32 entries. And a code typed by hand must
 * survive whatever case and surrounding whitespace it arrives in.
 */

import { describe, expect, it } from 'vitest';
import type { ValidationResult } from '../types/validation';
import {
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
  validateInviteCode,
} from './inviteCode';

/** Feeds a fixed byte sequence in place of the crypto source. */
const fixedBytes = (bytes: readonly number[]) => () => Uint8Array.from(bytes);

/**
 * Stands in for the real source when only the shape of the output matters. Randomness
 * quality is the caller's concern, so a cheap generator is enough here.
 */
const varyingBytes = (byteLength: number) =>
  Uint8Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256));

/**
 * Asserts that the input was rejected and hands the message back for further checks.
 * Narrowing this way keeps the assertions typed, since Vitest's asymmetric matchers are not.
 */
function expectRejection(result: ValidationResult<unknown>): string {
  if (result.ok) {
    throw new Error(`expected a rejection, received ${JSON.stringify(result.value)}`);
  }
  expect(result.message).not.toBe('');
  return result.message;
}

describe('INVITE_CODE_ALPHABET', () => {
  it.each(['0', '1', 'I', 'O'])('leaves out the ambiguous character %s', (character) => {
    expect(INVITE_CODE_ALPHABET).not.toContain(character);
  });

  it('has 32 entries, which is what keeps the byte mapping unbiased', () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    expect(256 % INVITE_CODE_ALPHABET.length).toBe(0);
  });

  it('has no duplicate characters', () => {
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(INVITE_CODE_ALPHABET.length);
  });
});

describe('generateInviteCode', () => {
  it('produces a code of the expected length using only the alphabet', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generateInviteCode(varyingBytes);
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]+$`));
    }
  });

  it('maps each byte through the alphabet in order', () => {
    expect(generateInviteCode(fixedBytes([0, 1, 2, 3, 4, 5, 6, 7]))).toBe('23456789');
  });

  it('wraps around, so a byte and that byte plus 32 give the same character', () => {
    expect(generateInviteCode(fixedBytes([0, 32, 64, 96, 128, 160, 192, 224]))).toBe('22222222');
  });

  it('spreads all 256 byte values evenly over the alphabet', () => {
    const counts = new Map<string, number>();

    for (let start = 0; start < 256; start += INVITE_CODE_LENGTH) {
      const chunk = Array.from({ length: INVITE_CODE_LENGTH }, (_, offset) => start + offset);
      for (const character of generateInviteCode(fixedBytes(chunk))) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }

    expect(counts.size).toBe(INVITE_CODE_ALPHABET.length);
    expect([...counts.values()]).toEqual(
      new Array<number>(INVITE_CODE_ALPHABET.length).fill(256 / INVITE_CODE_ALPHABET.length),
    );
  });

  it('fails loudly when the random source returns too few bytes', () => {
    expect(() => generateInviteCode(fixedBytes([1, 2, 3]))).toThrow(/expected 8/);
  });
});

describe('normalizeInviteCode', () => {
  it('upper-cases and trims, so storage and lookup agree', () => {
    expect(normalizeInviteCode('  a2b3c4d5  ')).toBe('A2B3C4D5');
  });
});

describe('validateInviteCode', () => {
  it('accepts a code typed in lower case and returns it normalised', () => {
    expect(validateInviteCode('a2b3c4d5')).toEqual({ ok: true, value: 'A2B3C4D5' });
  });

  it('accepts a code pasted with surrounding whitespace', () => {
    expect(validateInviteCode(' A2B3C4D5\n')).toEqual({ ok: true, value: 'A2B3C4D5' });
  });

  it.each(['A2B3C4D', 'A2B3C4D5E'])('rejects the wrong-length code %s', (value) => {
    expectRejection(validateInviteCode(value));
  });

  it.each(['A2B3C4D0', 'A2B3C4DI'])('rejects %s, which uses an excluded character', (value) => {
    expectRejection(validateInviteCode(value));
  });

  it('rejects a code containing a symbol', () => {
    expectRejection(validateInviteCode('A2B3-C4D'));
  });

  it.each([undefined, null, 12345678])('rejects the non-string value %s', (value) => {
    expectRejection(validateInviteCode(value));
  });
});
