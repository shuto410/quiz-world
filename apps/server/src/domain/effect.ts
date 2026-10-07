/**
 * Decides whether the host may sound the correct/wrong cue without judging anybody.
 *
 * The cue changes no state, so this is a check rather than a transition, like closing the
 * room. It is still decided here, from the room state, because "is this the host" and "is
 * anybody waiting for a verdict" must not be answered by trusting the connection that asked.
 *
 * `answering` is refused: while a responder waits, the verdict buttons judge them, and a cue
 * that looked like a verdict without being one would mislead the whole room.
 */

import type { InternalRoomState, SocketErrorCode } from '@quiz-world/shared';

/** Whether the cue may be played, and why not when it may not. */
export type EffectPlayCheck = { ok: true } | { ok: false; code: SocketErrorCode };

export function checkEffectPlay(current: InternalRoomState, actorId: string): EffectPlayCheck {
  if (actorId !== current.hostId) return { ok: false, code: 'NOT_HOST' };
  if (current.status !== 'idle' && current.status !== 'result' && current.status !== 'matchResult')
    return { ok: false, code: 'INVALID_STATE' };
  return { ok: true };
}
