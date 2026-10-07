/**
 * Validates and explicitly copies a host's correction of one seat.
 *
 * Shared by the host's edit form and the socket handler, so both refuse the same values with
 * the same words. Like the rule validator it rebuilds the value field by field: anything else
 * the client sent is dropped rather than stored. The bounds are a safeguard, not a game rule,
 * and numeric strings are rejected rather than coerced.
 */
import type { ScoreAdjustment } from '../types/rules';
import type { ValidationResult } from '../types/validation';
import { INPUT_CONSTRAINTS } from './fields';

export function validateScoreAdjustment(value: unknown): ValidationResult<ScoreAdjustment> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { ok: false, message: '修正する値を入力してください' };
  const item = value as Record<string, unknown>;
  if (item['type'] === 'points') {
    const { min, max } = INPUT_CONSTRAINTS.adjustedScore;
    const score = item['score'];
    if (!integerInRange(score, min, max))
      return { ok: false, message: `得点は${min}〜${max}の整数で入力してください` };
    return { ok: true, value: { type: 'points', score } };
  }
  if (item['type'] === 'maruBatsu') {
    const { min, max } = INPUT_CONSTRAINTS.adjustedCount;
    const correctCount = item['correctCount'];
    const wrongCount = item['wrongCount'];
    if (!integerInRange(correctCount, min, max) || !integerInRange(wrongCount, min, max))
      return { ok: false, message: `○数・×数は${min}〜${max}の整数で入力してください` };
    return { ok: true, value: { type: 'maruBatsu', correctCount, wrongCount } };
  }
  return { ok: false, message: '修正する値を入力してください' };
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
