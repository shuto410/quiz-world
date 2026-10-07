/** Host corrections reject malformed totals before any room state can change. */
import { describe, expect, it } from 'vitest';
import { validateScoreAdjustment } from './scoreAdjustment';

describe('validateScoreAdjustment', () => {
  it.each([
    { type: 'points', score: 999 },
    { type: 'points', score: -999 },
    { type: 'points', score: 0 },
    { type: 'maruBatsu', correctCount: 0, wrongCount: 0 },
    { type: 'maruBatsu', correctCount: 99, wrongCount: 99 },
  ])('accepts and explicitly rebuilds %j', (adjustment) => {
    expect(validateScoreAdjustment({ ...adjustment, hidden: 'discard' })).toEqual({
      ok: true,
      value: adjustment,
    });
  });
  it.each([
    null,
    [],
    {},
    { type: 'other', score: 1 },
    ...[undefined, '1', NaN, Infinity, 1.5, 1000, -1000].map((score) => ({
      type: 'points',
      score,
    })),
    ...[undefined, '1', NaN, Infinity, 1.5, -1, 100].flatMap((value) => [
      { type: 'maruBatsu', correctCount: value, wrongCount: 0 },
      { type: 'maruBatsu', correctCount: 0, wrongCount: value },
    ]),
  ])('rejects %j', (value) => expect(validateScoreAdjustment(value).ok).toBe(false));
});
