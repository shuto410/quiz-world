/**
 * Conversions of the authoritative room state into the views each audience may see.
 *
 * There is exactly one thing a participant must not see: the text of an answer that has not
 * been judged yet. Everything else, including who the host is and which buzz round is open,
 * is public within the room.
 *
 * This is a pure function of the state and lives in the domain layer, where the lint rules
 * forbid I/O, timers and clocks. It is the last thing that runs before state leaves the
 * server, so it must not be able to fail or depend on anything ambient.
 */

import type { InternalRoomState, ParticipantRoomState } from '@quiz-world/shared';

/**
 * Strips what participants are not allowed to see.
 *
 * While the judgement is on screen the answer is shown to everyone, which is the point of
 * the result screen. Before that, only the host sees it, so that nobody can read the
 * answer off their own screen and react to it.
 */
export function toParticipantRoomState(state: InternalRoomState): ParticipantRoomState {
  if (state.status === 'result') {
    return state;
  }

  const { currentSubmittedAnswer, ...visibleToParticipants } = state;
  return visibleToParticipants;
}
