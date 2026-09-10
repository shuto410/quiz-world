/**
 * Synchronous host takeover. The first accepted claimant resumes the paused game; subsequent
 * claims observe the resumed state and fail. A host never retains their own answer right.
 */
import type { InternalRoomState } from '@quiz-world/shared';
import { clearRound } from './round';
import { accept, reject, type TransitionResult } from './transition';

export function applyHostClaim(
  current: InternalRoomState,
  actorId: string,
  now: number,
): TransitionResult {
  const seat = current.participants.find((p) => p.id === actorId);
  const previousStatus = current.statusBeforePause;
  if (
    current.status !== 'paused' ||
    current.pausedReason !== 'hostDisconnected' ||
    current.hostOnline ||
    previousStatus === undefined ||
    previousStatus === 'paused' ||
    previousStatus === 'finished' ||
    seat === undefined ||
    !seat.online ||
    actorId === current.hostId
  ) {
    return reject('INVALID_STATE');
  }
  const { statusBeforePause, pausedReason, ...rest } = current;
  const resumed: InternalRoomState = {
    ...rest,
    status: previousStatus,
    initialHostId: current.initialHostId ?? current.hostId,
    hostId: actorId,
    hostOnline: true,
    updatedAt: now,
    buzzOrder: current.buzzOrder.filter((entry) => entry.participantId !== actorId),
  };
  if (previousStatus !== 'answering' || current.currentResponderId !== actorId)
    return accept(resumed);

  const index = current.buzzOrder.findIndex((entry) => entry.participantId === actorId);
  const next = index < 0 ? undefined : current.buzzOrder[index + 1];
  if (next === undefined) return accept(clearRound(resumed, 'idle', now));
  const { currentSubmittedAnswer, ...withoutAnswer } = resumed;
  return accept({ ...withoutAnswer, currentResponderId: next.participantId });
}
