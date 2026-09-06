/**
 * Pure transitions for ending a tournament and for closing the room afterwards.
 *
 * Ending is only accepted from `idle` and `result`, the two points where nobody holds the
 * answer right. A tournament that ended mid-answer would leave a participant waiting for a
 * judgement that can no longer come, and the host is one click away from either state.
 *
 * Closing the room is not a state transition at all: the room stops existing on this server.
 * It is still decided here, because the two questions it turns on — is this the host, and has
 * the tournament ended — are questions about the room state, and the handler must not answer
 * them by trusting the connection that asked.
 */

import type { InternalRoomState, SocketErrorCode } from '@quiz-world/shared';
import { clearRound } from './round';
import { accept, reject, type TransitionResult } from './transition';

export type TournamentFinishInput = {
  /** Resolved from the socket session. Must be the seat that currently holds authority. */
  actorId: string;
  now: number;
};

/** Whether the room may be closed, and why not when it may not. */
export type RoomCloseCheck = { ok: true } | { ok: false; code: SocketErrorCode };

/**
 * Ends the tournament and moves everyone to the final result.
 *
 * The leftovers of the last round are cleared. The final screen is about the standings, and
 * a judgement or an answer left in the state would be shown to the host and hidden from the
 * participants, which is a difference with no meaning once the tournament is over.
 */
export function applyTournamentFinish(
  current: InternalRoomState,
  input: TournamentFinishInput,
): TransitionResult {
  if (input.actorId !== current.hostId) {
    return reject('NOT_HOST');
  }

  if (current.status !== 'idle' && current.status !== 'result') {
    return reject('INVALID_STATE');
  }

  return accept(clearRound(current, 'finished', input.now));
}

/**
 * Decides whether this connection may tear the room down.
 *
 * Only after the tournament has finished: closing is what disconnects everyone, so it must
 * not be reachable while a round is in progress.
 */
export function checkRoomClose(current: InternalRoomState, actorId: string): RoomCloseCheck {
  if (actorId !== current.hostId) {
    return { ok: false, code: 'NOT_HOST' };
  }

  if (current.status !== 'finished') {
    return { ok: false, code: 'INVALID_STATE' };
  }

  return { ok: true };
}
