/**
 * Pure transitions for the boundary between two matches played in the same room.
 *
 * A tournament is a sitting of several matches. The room, its seats and the invitation outlive
 * a match; the points and counts do not. Ending a match is therefore split in two, with the
 * standings on screen in between:
 *
 * - `applyMatchFinish` stops play and moves to `matchResult`. Scores are untouched, so what
 *   everyone sees is exactly what the last judgement produced.
 * - `applyMatchNext` zeroes every seat and returns to `idle`. The finished match is not kept
 *   anywhere. Rules stay as they were, and because the rule lock is derived from the counts,
 *   zeroing them is also what lets the host change rules for the next match.
 *
 * Ending is accepted from `idle` and `result` only, for the same reason as ending the
 * tournament: nobody may be left holding an answer right that can no longer be judged.
 */

import type { InternalRoomState } from '@quiz-world/shared';
import { clearRound } from './round';
import { accept, reject, type TransitionResult } from './transition';

/** Host match control carries nothing but the actor resolved from the socket session. */
export type MatchControlInput = { actorId: string; now: number };

/** Ends the current match and shows its standings, leaving every score in place. */
export function applyMatchFinish(
  current: InternalRoomState,
  input: MatchControlInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'idle' && current.status !== 'result') return reject('INVALID_STATE');
  return accept(clearRound(current, 'matchResult', input.now));
}

/** Starts the next match: same seats and rules, every score and count back to zero. */
export function applyMatchNext(
  current: InternalRoomState,
  input: MatchControlInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'matchResult') return reject('INVALID_STATE');
  return accept({
    ...clearRound(current, 'idle', input.now),
    participants: current.participants.map((participant) => ({
      ...participant,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
    })),
  });
}
