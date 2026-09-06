/**
 * Pure transition for a written answer sent by the current responder.
 *
 * Like `applyBuzz`, this is a synchronous function of the current state and the server's
 * receive time, applied through `RoomRegistry.update()` so that nothing runs between reading
 * and writing the room. The text arrives already trimmed and length-checked: field-level
 * validation belongs to the caller, which shares `validateAnswerText` with the client, so
 * this module only decides who may write into the state and when.
 *
 * The two refusals are deliberately different. A status other than `answering` is refused
 * with `INVALID_STATE`, because the answer right cannot exist outside it and reporting a
 * missing answer right would suggest the room was otherwise ready for an answer. Inside
 * `answering`, a sender who is not the responder is refused with `NOT_CURRENT_RESPONDER`,
 * which is the one thing they can act on: wait, or buzz and be judged first.
 *
 * Only the latest answer is kept. Resubmitting overwrites, because the host judges what is
 * on screen at the moment of judging, and an answer history is explicitly not stored.
 */

import type { InternalRoomState } from '@quiz-world/shared';
import { accept, reject, type TransitionResult } from './transition';

export type AnswerSubmitInput = {
  /** Resolved from the socket session, never taken from the client payload. */
  participantId: string;
  /** Trimmed and length-checked by the caller. */
  answerText: string;
  /** Server receive time in epoch milliseconds. */
  now: number;
};

/**
 * Records the current responder's answer.
 *
 * The host seat needs no special case: the host cannot buzz, so it can never be
 * `currentResponderId` and is refused by the same check as any other bystander.
 */
export function applyAnswerSubmit(
  current: InternalRoomState,
  input: AnswerSubmitInput,
): TransitionResult {
  if (current.status !== 'answering') {
    return reject('INVALID_STATE');
  }

  if (current.currentResponderId !== input.participantId) {
    return reject('NOT_CURRENT_RESPONDER');
  }

  return accept({
    ...current,
    currentSubmittedAnswer: {
      participantId: input.participantId,
      answerText: input.answerText,
      receivedAt: input.now,
    },
    updatedAt: input.now,
  });
}
