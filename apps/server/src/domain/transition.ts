/**
 * The shape every state transition returns.
 *
 * A transition either produces the next room state or refuses with a code the client can be
 * told about. Refusal is a normal outcome, not an exception: pressing the buzzer while the
 * result is on screen is something participants do constantly, and it must cost no more than
 * an ignored event.
 *
 * Returning the next state instead of mutating the current one is what makes a rejected
 * transition safe. There is no half-applied state to roll back.
 */

import type { InternalRoomState, SocketErrorCode } from '@quiz-world/shared';

export type TransitionAccepted = {
  ok: true;
  state: InternalRoomState;
};

export type TransitionRejected = {
  ok: false;
  code: SocketErrorCode;
};

export type TransitionResult = TransitionAccepted | TransitionRejected;

/**
 * A state transition.
 *
 * Deliberately synchronous. Node runs one thing at a time, so a transition that never awaits
 * cannot be interleaved with another buzz arriving; the moment one awaits, the ordering
 * guarantee that the whole product rests on is gone.
 */
export type RoomTransition = (current: InternalRoomState) => TransitionResult;

/** Convenience for the common accepted case. */
export function accept(state: InternalRoomState): TransitionAccepted {
  return { ok: true, state };
}

/** Convenience for the common rejected case. */
export function reject(code: SocketErrorCode): TransitionRejected {
  return { ok: false, code };
}
