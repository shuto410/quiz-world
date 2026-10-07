/**
 * Pure transition for a host correcting one seat's score by hand.
 *
 * Judging is immediate and has no undo, so this is how a mistaken verdict is repaired; it
 * serves bonuses and handicaps the same way. The correction carries new totals in the unit the
 * current rules decide by, and is refused when that unit is not the one in force, so a form
 * opened before a rule change cannot write the wrong field.
 *
 * It is accepted wherever nobody holds the answer right: `idle`, `result` and `matchResult`.
 * `answering` is refused on purpose. Correcting the responder into a win or an elimination
 * there would make their pending answer unjudgeable, and the round could not be left.
 *
 * Nothing else moves. In particular the last judgement stays on screen as it was given; the
 * standings beside it are what show the correction.
 */

import type { InternalRoomState, ScoreAdjustment } from '@quiz-world/shared';
import { accept, reject, type TransitionResult } from './transition';

export type ScoreAdjustInput = {
  /** Resolved from the socket session. Must be the seat that currently holds authority. */
  actorId: string;
  /** The seat being corrected, which is never the host seat. */
  targetParticipantId: string;
  /** Already validated by the caller with the shared validator. */
  adjustment: ScoreAdjustment;
  now: number;
};

export function applyScoreAdjust(
  current: InternalRoomState,
  input: ScoreAdjustInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'idle' && current.status !== 'result' && current.status !== 'matchResult')
    return reject('INVALID_STATE');
  const { adjustment } = input;
  if (adjustment.type !== current.rules.type) return reject('INVALID_STATE');
  const target = current.participants.find((p) => p.id === input.targetParticipantId);
  if (target === undefined || target.id === current.hostId) return reject('INVALID_STATE');
  return accept({
    ...current,
    participants: current.participants.map((p) =>
      p.id !== target.id
        ? p
        : adjustment.type === 'points'
          ? { ...p, score: adjustment.score }
          : {
              ...p,
              // One point per correct answer under these rules, so the score cannot disagree.
              score: adjustment.correctCount,
              correctCount: adjustment.correctCount,
              wrongCount: adjustment.wrongCount,
            },
    ),
    updatedAt: input.now,
  });
}
