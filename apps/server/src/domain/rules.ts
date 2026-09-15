/** Only the current host may set rules, before any judgement and outside an open round. */
import { hasJudgements, type GameRules, type InternalRoomState } from '@quiz-world/shared';
import { accept, reject, type TransitionResult } from './transition';

/** Actor comes from the socket session and rules have passed shared validation. */
export type RulesUpdateInput = { actorId: string; rules: GameRules; now: number };
export function applyRulesUpdate(
  current: InternalRoomState,
  input: RulesUpdateInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'idle' || hasJudgements(current.participants))
    return reject('INVALID_STATE');
  return accept({ ...current, rules: input.rules, updatedAt: input.now });
}
