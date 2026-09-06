/**
 * Tests for the field validators.
 *
 * The three text fields share their behaviour, so the common rules are checked once in a
 * table over all of them and only the differing limit is checked individually. What matters
 * here is the boundaries and the normalisation: off-by-one on a length limit and forgetting
 * to trim are the two mistakes that would actually reach a user.
 */

import { describe, expect, it } from 'vitest';
import type { ValidationResult } from '../types/validation';
import {
  INPUT_CONSTRAINTS,
  validateAnswerText,
  validateDisplayName,
  validateMaxParticipants,
  validateScoreDelta,
  validateTournamentName,
} from './fields';

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

const textFields = [
  {
    name: 'validateTournamentName',
    validate: validateTournamentName,
    label: '大会名',
    maxLength: INPUT_CONSTRAINTS.tournamentName.maxLength,
  },
  {
    name: 'validateDisplayName',
    validate: validateDisplayName,
    label: '表示名',
    maxLength: INPUT_CONSTRAINTS.displayName.maxLength,
  },
  {
    name: 'validateAnswerText',
    validate: validateAnswerText,
    label: '回答',
    maxLength: INPUT_CONSTRAINTS.answerText.maxLength,
  },
];

describe.each(textFields)('$name', ({ validate, label, maxLength }) => {
  it('accepts a value exactly at the limit', () => {
    const value = 'あ'.repeat(maxLength);
    expect(validate(value)).toEqual({ ok: true, value });
  });

  it('rejects a value one character over the limit', () => {
    expect(expectRejection(validate('あ'.repeat(maxLength + 1)))).toContain(label);
  });

  it('measures the length after trimming, so padding does not eat into the limit', () => {
    const value = 'あ'.repeat(maxLength);
    expect(validate(`  ${value}  `)).toEqual({ ok: true, value });
  });

  it('returns the trimmed value, including for full-width spaces', () => {
    expect(validate('\u3000 テスト \u3000')).toEqual({ ok: true, value: 'テスト' });
  });

  it('rejects a value that is blank once trimmed', () => {
    expect(expectRejection(validate(' \u3000 '))).toContain(label);
  });

  it('rejects an embedded newline, which would break the single-line layout', () => {
    expect(expectRejection(validate('前半\n後半'))).toContain(label);
  });

  it('keeps emoji intact rather than filtering zero-width joiners', () => {
    expect(validate('👨‍👩‍👧')).toEqual({ ok: true, value: '👨‍👩‍👧' });
  });

  it.each([undefined, null, 42, {}, []])('rejects the non-string value %s', (value) => {
    expect(expectRejection(validate(value))).toContain(label);
  });
});

describe('validateMaxParticipants', () => {
  const { min, max } = INPUT_CONSTRAINTS.maxParticipants;

  it.each([min, max])('accepts the boundary value %i', (value) => {
    expect(validateMaxParticipants(value)).toEqual({ ok: true, value });
  });

  it.each([min - 1, max + 1])('rejects the out-of-range value %i', (value) => {
    expectRejection(validateMaxParticipants(value));
  });

  it('rejects a fractional value', () => {
    expectRejection(validateMaxParticipants(10.5));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    expectRejection(validateMaxParticipants(value));
  });

  it('rejects a numeric string instead of coercing it', () => {
    expectRejection(validateMaxParticipants('10'));
  });

  it('names both bounds in the message so the user knows the range', () => {
    expect(expectRejection(validateMaxParticipants(0))).toContain(`${min}〜${max}`);
  });
});

describe('validateScoreDelta', () => {
  const { min, max } = INPUT_CONSTRAINTS.scoreDelta;

  it.each([min, max, -1, 0, 1])(
    'accepts %i, since judging may deduct or award nothing',
    (value) => {
      expect(validateScoreDelta(value)).toEqual({ ok: true, value });
    },
  );

  it.each([min - 1, max + 1])('rejects the out-of-range value %i', (value) => {
    expectRejection(validateScoreDelta(value));
  });

  it('rejects a fractional value, which would make scores impossible to reconcile', () => {
    expectRejection(validateScoreDelta(1.5));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    expectRejection(validateScoreDelta(value));
  });

  it('rejects a numeric string instead of coercing it', () => {
    expectRejection(validateScoreDelta('1'));
  });

  it('names both bounds in the message so the host knows the range', () => {
    expect(expectRejection(validateScoreDelta(1000))).toContain(`${min}〜${max}`);
  });
});
