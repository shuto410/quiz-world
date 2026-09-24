/**
 * Judging synchronously applies configured points and counts, then broadcasts a result.
 * Progression is a separate transition that never scores. Round identity and responder
 * identity prevent delayed or repeated requests from judging a different answer.
 */
import {
  getJudgeScoreDelta,
  getParticipantStanding,
  type InternalRoomState,
} from '@quiz-world/shared';
import { clearRound } from './round';
import { accept, reject, type TransitionResult } from './transition';

/** Session actor and the exact round/responder visible when the host pressed a verdict. */
export type JudgeInput = {
  actorId: string;
  targetParticipantId: string;
  buzzSessionId: string;
  isCorrect: boolean;
  now: number;
};
/** Host progression carries no score or verdict. */
export type GameResetInput = { actorId: string; now: number };

export function applyJudge(current: InternalRoomState, input: JudgeInput): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'answering' || current.currentBuzzSession?.id !== input.buzzSessionId)
    return reject('INVALID_STATE');
  const target = current.participants.find((p) => p.id === input.targetParticipantId);
  if (
    target === undefined ||
    target.id === current.hostId ||
    target.id !== current.currentResponderId ||
    getParticipantStanding(target, current.rules) !== 'playing'
  )
    return reject('INVALID_STATE');
  const scoreDelta = getJudgeScoreDelta(current.rules, input.isCorrect);
  return accept({
    ...current,
    status: 'result',
    participants: current.participants.map((p) =>
      p.id === target.id
        ? {
            ...p,
            score: p.score + scoreDelta,
            correctCount: p.correctCount + (input.isCorrect ? 1 : 0),
            wrongCount: p.wrongCount + (input.isCorrect ? 0 : 1),
          }
        : p,
    ),
    lastResult: { participantId: target.id, isCorrect: input.isCorrect, scoreDelta },
    updatedAt: input.now,
  });
}

export function applyGameReset(
  current: InternalRoomState,
  input: GameResetInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (current.status !== 'result') return reject('INVALID_STATE');
  return accept(clearRound(current, 'idle', input.now));
}

export function applyNextResponder(
  current: InternalRoomState,
  input: GameResetInput,
): TransitionResult {
  if (input.actorId !== current.hostId) return reject('NOT_HOST');
  if (
    current.status !== 'result' ||
    current.lastResult?.isCorrect !== false ||
    !current.currentBuzzSession
  )
    return reject('INVALID_STATE');
  const index = current.buzzOrder.findIndex((p) => p.participantId === current.currentResponderId);
  const nextId = index < 0 ? undefined : current.buzzOrder[index + 1]?.participantId;
  const next = current.participants.find((p) => p.id === nextId);
  if (
    !next ||
    next.id === current.hostId ||
    getParticipantStanding(next, current.rules) !== 'playing'
  )
    return reject('NO_NEXT_RESPONDER');
  const { currentSubmittedAnswer, ...rest } = current;
  return accept({
    ...rest,
    status: 'answering',
    currentResponderId: next.id,
    updatedAt: input.now,
  });
}
