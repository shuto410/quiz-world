/** Checks the signed presentation of positive, negative and zero point changes. */
import { describe, expect, it } from 'vitest';
import { formatScoreDelta } from './scoreDelta';

describe('formatScoreDelta', () => {
  it.each([
    [3, '+3'],
    [-2, '-2'],
    [0, '±0'],
  ])('formats %i as %s', (scoreDelta, expected) => {
    expect(formatScoreDelta(scoreDelta)).toBe(expected);
  });
});
