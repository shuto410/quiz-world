/**
 * Host judgement, rule settings and progression all commit through the room registry.
 * The actor is resolved from the session; accepted and refused transitions share the
 * sole broadcast path, which also removes private answers for participants.
 */
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InternalRoomState,
} from '@quiz-world/shared';
import { validateGameRules } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyGameReset, applyJudge, applyNextResponder } from '../domain/judge';
import { applyRulesUpdate } from '../domain/rules';
import type { TransitionResult } from '../domain/transition';
import { isRecord } from '../guards';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
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
  const update = (
    transition: (state: InternalRoomState, actorId: string, now: number) => TransitionResult,
  ) => {
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
    const result = handle.update((current) =>
      transition(current, session.participantId, dependencies.now()),
    );
    if (!result.ok) emitError(socket, result.code);
    broadcastRoomState(dependencies.io, handle);
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
    update((state, actorId, now) =>
      applyJudge(state, {
        actorId,
        now,
        targetParticipantId: payload.participantId,
        buzzSessionId: payload.buzzSessionId,
        isCorrect: payload.isCorrect,
      }),
    );
  });
  socket.on('game:reset', () =>
    update((state, actorId, now) => applyGameReset(state, { actorId, now })),
  );
  socket.on('game:next-responder', () =>
    update((state, actorId, now) => applyNextResponder(state, { actorId, now })),
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
