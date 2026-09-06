/**
 * Tests for reading and displaying a score change.
 *
 * The parsing cases are the ones a host can actually produce with a number field: an empty
 * box, a half-typed minus sign, a decimal, and a value past the shared limit.
 */

import { describe, expect, it } from 'vitest';
import { formatScoreDelta, parseScoreDelta } from './scoreDelta';

describe('parseScoreDelta', () => {
  it.each([
    ['1', 1],
    ['-1', -1],
    ['0', 0],
    ['  2  ', 2],
  ])('reads %s as %i', (text, value) => {
    expect(parseScoreDelta(text)).toEqual({ ok: true, value });
  });

  it.each(['', '   '])('asks for a value when the field is blank (%s)', (text) => {
    expect(parseScoreDelta(text)).toEqual({ ok: false, message: '得点を入力してください' });
  });

  it.each(['-', 'abc', '1.5', '1000'])('rejects %s with the shared range message', (text) => {
    const result = parseScoreDelta(text);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.message).toContain('-999〜999');
  });
});

describe('formatScoreDelta', () => {
  it.each([
    [3, '+3'],
    [-2, '-2'],
    [0, '±0'],
  ])('formats %i as %s', (scoreDelta, expected) => {
    expect(formatScoreDelta(scoreDelta)).toBe(expected);
  });
});
