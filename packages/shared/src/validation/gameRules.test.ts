/** Rule settings reject malformed values before any room state can change. */
import { describe, expect, it } from 'vitest';
import { validateGameRules } from './gameRules';

describe('validateGameRules', () => {
  it.each([
    { type: 'points', correctPoints: 999, wrongPoints: -999 },
    { type: 'points', correctPoints: 0, wrongPoints: 0 },
    { type: 'maruBatsu', correctTarget: 7, wrongLimit: 3 },
    { type: 'maruBatsu', correctTarget: 1, wrongLimit: 99 },
  ])('accepts and explicitly rebuilds %j', (rules) => {
    expect(validateGameRules({ ...rules, hidden: 'discard' })).toEqual({ ok: true, value: rules });
  });
  it.each([
    null,
    [],
    {},
    { type: 'other' },
    ...[undefined, '1', NaN, Infinity, 1.5, 1000, -1000].flatMap((value) => [
      { type: 'points', correctPoints: value, wrongPoints: 0 },
      { type: 'points', correctPoints: 1, wrongPoints: value },
    ]),
    ...[undefined, '7', NaN, Infinity, 0, -1, 1.5, 100].flatMap((value) => [
      { type: 'maruBatsu', correctTarget: value, wrongLimit: 3 },
      { type: 'maruBatsu', correctTarget: 7, wrongLimit: value },
    ]),
  ])('rejects %j', (value) => expect(validateGameRules(value).ok).toBe(false));
});
