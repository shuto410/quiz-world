/** Validates and explicitly copies host-supplied rules for both browser forms and sockets. */
import type { GameRules } from '../types/rules';
import { INPUT_CONSTRAINTS, validateScoreDelta } from './fields';

/** Validation carries only a safe normalized rule or a user-facing explanation. */
type RulesValidation = { ok: true; value: GameRules } | { ok: false; message: string };
export function validateGameRules(value: unknown): RulesValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { ok: false, message: 'ルールを選択してください' };
  const item = value as Record<string, unknown>;
  if (item['type'] === 'points') {
    const correct = validateScoreDelta(item['correctPoints']);
    const wrong = validateScoreDelta(item['wrongPoints']);
    if (!correct.ok) return correct;
    if (!wrong.ok) return wrong;
    return {
      ok: true,
      value: { type: 'points', correctPoints: correct.value, wrongPoints: wrong.value },
    };
  }
  if (item['type'] === 'maruBatsu') {
    const { min, max } = INPUT_CONSTRAINTS.maruBatsuCount;
    const correctTarget = item['correctTarget'];
    const wrongLimit = item['wrongLimit'];
    if (!integerInRange(correctTarget, min, max) || !integerInRange(wrongLimit, min, max))
      return { ok: false, message: `正解数・誤答数は${min}〜${max}の整数で入力してください` };
    return { ok: true, value: { type: 'maruBatsu', correctTarget, wrongLimit } };
  }
  return { ok: false, message: 'ルールを選択してください' };
}
function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
