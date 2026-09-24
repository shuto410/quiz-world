/**
 * Leaving a question clears its buzz order, responder, answer and last judgement together.
 * Reset and tournament finish share this boundary; neither changes scores, counts or rules.
 * Judging retains the round for result display and optional next-responder progression.
 */

import type { GameStatus, InternalRoomState } from '@quiz-world/shared';

/** Returns the room with the finished round removed, in the given status. */
export function clearRound(
  state: InternalRoomState,
  status: GameStatus,
  now: number,
): InternalRoomState {
  const { currentBuzzSession, currentResponderId, currentSubmittedAnswer, lastResult, ...rest } =
    state;

  return {
    ...rest,
    status,
    buzzOrder: [],
    updatedAt: now,
  };
}
