/**
 * Whether the viewer's answer field should be live.
 *
 * Derived from the broadcast room state, never stored on the server. Matches
 * `applyAnswerSubmit`: only the participant named by `currentResponderId` may send, and only
 * while the round is open. Everyone else keeps the field visible but inert, so that the
 * layout does not shift when the answer right moves.
 */

import type { GameStatus } from '@quiz-world/shared';

export type CanSubmitAnswerInput = {
  status: GameStatus | undefined;
  participantId: string | undefined;
  currentResponderId: string | undefined;
};

/** True when submitting an answer would be accepted by the server right now. */
export function canSubmitAnswer({
  status,
  participantId,
  currentResponderId,
}: CanSubmitAnswerInput): boolean {
  if (status !== 'answering') {
    return false;
  }
  if (participantId === undefined || currentResponderId === undefined) {
    return false;
  }
  return participantId === currentResponderId;
}
