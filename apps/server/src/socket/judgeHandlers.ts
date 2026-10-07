/**
 * Host judgement, rule settings, score corrections, progression and match boundaries all
 * commit through the room registry.
 * The actor is resolved from the session; accepted and refused transitions share the
 * sole broadcast path, which also removes private answers for participants. An accepted
 * verdict additionally cues the correct/wrong flourish for the whole room, and the host can
 * send the same cue alone while nobody is waiting to be judged.
 */
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InternalRoomState,
} from '@quiz-world/shared';
import { validateGameRules, validateScoreAdjustment } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyScoreAdjust } from '../domain/adjust';
import { checkEffectPlay } from '../domain/effect';
import { applyGameReset, applyJudge, applyNextResponder } from '../domain/judge';
import { applyMatchFinish, applyMatchNext } from '../domain/match';
import { applyRulesUpdate } from '../domain/rules';
import type { TransitionResult } from '../domain/transition';
import { isRecord } from '../guards';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastJudgementEffect, broadcastRoomState, type SocketServer } from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession } from './session';

/** Infrastructure remains outside the synchronous transition functions. */
export type JudgeHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  now: () => number;
};
/** Socket event types are shared with the browser. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerJudgeHandlers(
  socket: AppSocket,
  dependencies: JudgeHandlerDependencies,
): void {
  /** Returns the tournament whose state changed, so a caller can follow up on acceptance. */
  const update = (
    transition: (state: InternalRoomState, actorId: string, now: number) => TransitionResult,
  ): string | undefined => {
    const session = readSession(socket.data);
    if (!session) {
      emitError(socket, 'INVALID_STATE');
      return undefined;
    }
    const handle = dependencies.registry.find(session.tournamentId);
    if (!handle) {
      emitError(socket, 'TOURNAMENT_NOT_FOUND');
      return undefined;
    }
    const result = handle.update((current) =>
      transition(current, session.participantId, dependencies.now()),
    );
    if (!result.ok) emitError(socket, result.code);
    broadcastRoomState(dependencies.io, handle);
    return result.ok ? session.tournamentId : undefined;
  };

  socket.on('judge:submit', (payload) => {
    if (
      !isRecord(payload) ||
      typeof payload['participantId'] !== 'string' ||
      !payload['participantId'] ||
      typeof payload['buzzSessionId'] !== 'string' ||
      !payload['buzzSessionId'] ||
      typeof payload['isCorrect'] !== 'boolean' ||
      'scoreDelta' in payload ||
      'nextAction' in payload
    ) {
      emitError(socket, 'VALIDATION_ERROR');
      return;
    }
    const judged = update((state, actorId, now) =>
      applyJudge(state, {
        actorId,
        now,
        targetParticipantId: payload.participantId,
        buzzSessionId: payload.buzzSessionId,
        isCorrect: payload.isCorrect,
      }),
    );
    // After the state, so the cue lands on a screen already showing the verdict.
    if (judged !== undefined) broadcastJudgementEffect(dependencies.io, judged, payload.isCorrect);
  });
  socket.on('effect:play', (payload) => {
    if (!isRecord(payload) || typeof payload['isCorrect'] !== 'boolean') {
      emitError(socket, 'VALIDATION_ERROR');
      return;
    }
    const session = readSession(socket.data);
    if (!session) {
      emitError(socket, 'INVALID_STATE');
      return;
    }
    const handle = dependencies.registry.find(session.tournamentId);
    if (!handle) {
      emitError(socket, 'TOURNAMENT_NOT_FOUND');
      return;
    }
    const allowed = checkEffectPlay(handle.read(), session.participantId);
    if (!allowed.ok) {
      emitError(socket, allowed.code);
      broadcastRoomState(dependencies.io, handle);
      return;
    }
    broadcastJudgementEffect(dependencies.io, session.tournamentId, payload['isCorrect']);
  });
  socket.on('game:reset', () =>
    update((state, actorId, now) => applyGameReset(state, { actorId, now })),
  );
  socket.on('game:next-responder', () =>
    update((state, actorId, now) => applyNextResponder(state, { actorId, now })),
  );
  socket.on('score:adjust', (payload) => {
    const targetParticipantId = isRecord(payload) ? payload['participantId'] : undefined;
    if (typeof targetParticipantId !== 'string' || !targetParticipantId) {
      emitError(socket, 'VALIDATION_ERROR');
      return;
    }
    const parsed = validateScoreAdjustment(isRecord(payload) ? payload['adjustment'] : undefined);
    if (!parsed.ok) {
      socket.emit('error', { code: 'VALIDATION_ERROR', message: parsed.message });
      return;
    }
    update((state, actorId, now) =>
      applyScoreAdjust(state, { actorId, now, targetParticipantId, adjustment: parsed.value }),
    );
  });
  socket.on('match:finish', () =>
    update((state, actorId, now) => applyMatchFinish(state, { actorId, now })),
  );
  socket.on('match:next', () =>
    update((state, actorId, now) => applyMatchNext(state, { actorId, now })),
  );
  socket.on('game:rules-update', (payload) => {
    const parsed = validateGameRules(isRecord(payload) ? payload['rules'] : undefined);
    if (!parsed.ok) {
      socket.emit('error', { code: 'VALIDATION_ERROR', message: parsed.message });
      return;
    }
    update((state, actorId, now) => applyRulesUpdate(state, { actorId, now, rules: parsed.value }));
  });
}
function emitError(socket: AppSocket, code: Parameters<typeof socketErrorMessage>[0]): void {
  socket.emit('error', { code, message: socketErrorMessage(code) });
}
