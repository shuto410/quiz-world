/**
 * Pure transitions for judging an answer and for closing the result screen.
 *
 * A judgement is the only operation that changes a score, and scores are add-only: there is
 * no edit operation to undo one with. So the guards here are about aim rather than about
 * permission alone — the sender must hold host authority, the room must have a live round,
 * and the participant named in the payload must be the one who currently holds the answer
 * right. That last check is what a stale host screen runs into: if the answer right moved on
 * between rendering and clicking, the judgement is refused instead of landing on whoever
 * happens to hold it now.
 *
 * `game:reset` is a separate operation from `judge:submit` for the same reason. Judging
 * always applies a score change, so if leaving the result screen were expressed as a
 * judgement with `resetToIdle`, the host would have a button that pays for the same answer
 * twice.
 *
 * Both functions are synchronous, like every transition in this layer: the domain lint rules
 * reject `async`, `await` and `Date.now()` so that a buzz arriving mid-judgement cannot be
 * interleaved with it.
 */

import type {
  BuzzEntry,
  InternalRoomState,
  JudgeNextAction,
  ParticipantState,
} from '@quiz-world/shared';
import { clearRound } from './round';
import { accept, reject, type TransitionResult } from './transition';

export type JudgeInput = {
  /** Resolved from the socket session. Must be the seat that currently holds authority. */
  actorId: string;
  /**
   * The participant being judged, taken from the host's payload rather than the session.
   * Must match `currentResponderId`.
   */
  targetParticipantId: string;
  isCorrect: boolean;
  /** Added to the target's score. Already checked to be an integer by the caller. */
  scoreDelta: number;
  /** Already checked against `JUDGE_NEXT_ACTIONS` by the caller. */
  nextAction: JudgeNextAction;
  /** Server receive time in epoch milliseconds. */
  now: number;
};

export type GameResetInput = {
  /** Resolved from the socket session. Must be the seat that currently holds authority. */
  actorId: string;
  now: number;
};

/**
 * Applies the host's judgement and moves the room where the host chose.
 *
 * The score change is applied for all three follow-up actions, including `resetToIdle`:
 * skipping the result screen is a presentation choice, not a decision to score nothing.
 * `moveToNextResponder` with an empty queue is refused before anything is applied, so a
 * retry after the refusal cannot award the points a second time.
 */
export function applyJudge(current: InternalRoomState, input: JudgeInput): TransitionResult {
  if (input.actorId !== current.hostId) {
    return reject('NOT_HOST');
  }

  if (current.status !== 'answering') {
    return reject('INVALID_STATE');
  }

  const target = findSeat(current.participants, input.targetParticipantId);
  if (target === undefined || target.id !== current.currentResponderId) {
    return reject('INVALID_STATE');
  }

  const judged: InternalRoomState = {
    ...current,
    participants: addScore(current.participants, target.id, input.scoreDelta),
  };

  switch (input.nextAction) {
    case 'showResult': {
      const { currentBuzzSession, currentResponderId, ...rest } = judged;
      return accept({
        ...rest,
        status: 'result',
        buzzOrder: [],
        // Deliberately kept: the result screen is where participants finally see the answer.
        lastResult: {
          participantId: target.id,
          isCorrect: input.isCorrect,
          scoreDelta: input.scoreDelta,
        },
        updatedAt: input.now,
      });
    }

    case 'resetToIdle': {
      return accept(reopenBuzzing(judged, input.now));
    }

    case 'moveToNextResponder': {
      const nextResponderId = findNextResponderId(current.buzzOrder, target.id);
      if (nextResponderId === undefined) {
        return reject('NO_NEXT_RESPONDER');
      }

      const { currentSubmittedAnswer, ...rest } = judged;
      return accept({
        ...rest,
        // The round and its ranks stay: the next responder was chosen from that order.
        currentResponderId: nextResponderId,
        updatedAt: input.now,
      });
    }
  }
}

/**
 * Closes the result screen and reopens buzzing.
 *
 * Carries no judgement and touches no score. The judgement it clears was already applied
 * when it was made.
 */
export function applyGameReset(
  current: InternalRoomState,
  input: GameResetInput,
): TransitionResult {
  if (input.actorId !== current.hostId) {
    return reject('NOT_HOST');
  }

  if (current.status !== 'result') {
    return reject('INVALID_STATE');
  }

  return accept(reopenBuzzing(current, input.now));
}

/**
 * Returns the room to `idle` with nothing left over from the finished round.
 *
 * `buzzOrder` in particular has to go: a participant may only buzz once per entry in it, so
 * carrying it into the next question would leave everyone who pressed last time unable to
 * press again.
 */
function reopenBuzzing(state: InternalRoomState, now: number): InternalRoomState {
  return clearRound(state, 'idle', now);
}

function addScore(
  participants: readonly ParticipantState[],
  participantId: string,
  scoreDelta: number,
): ParticipantState[] {
  return participants.map((participant) =>
    participant.id === participantId
      ? { ...participant, score: participant.score + scoreDelta }
      : participant,
  );
}

function findSeat(
  participants: readonly ParticipantState[],
  participantId: string,
): ParticipantState | undefined {
  return participants.find((participant) => participant.id === participantId);
}

/**
 * The entry after the current responder in the order the buzzes arrived in.
 *
 * Offline participants are not skipped. Whether somebody is able to answer is the host's
 * call, made with a voice channel this server knows nothing about; a server-side skip rule
 * would silently disagree with the host's own view of the room.
 */
function findNextResponderId(
  buzzOrder: readonly BuzzEntry[],
  currentResponderId: string,
): string | undefined {
  const current = buzzOrder.findIndex((entry) => entry.participantId === currentResponderId);
  if (current === -1) {
    return undefined;
  }
  return buzzOrder[current + 1]?.participantId;
}
