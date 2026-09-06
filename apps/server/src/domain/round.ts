/**
 * What it means to leave a buzz round behind.
 *
 * Three transitions end a round: `resetToIdle`, `game:reset` and `tournament:finish`. They
 * differ only in the status they land on, so the list of fields to drop lives here instead of
 * in each of them. A duplicated list is how a field added later gets cleared in two places
 * out of three, and the one that forgets leaves a stale responder or an unjudged answer in a
 * room that has moved on.
 *
 * `showResult` is deliberately not expressed here: it keeps the answer text so that the
 * result screen can show it, so it is a different rule rather than this one with an option.
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
