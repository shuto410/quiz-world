/**
 * Socket handlers for the host's progression controls: `judge:submit` and `game:reset`.
 *
 * Both resolve the actor from the socket session and hand a synchronous transition to
 * `RoomRegistry.update()`, so the host's authority is checked against the room state rather
 * than against what the client claims to be. Hiding the buttons is not the control; the
 * domain refusing a non-host is.
 *
 * The judgement payload is the only one in the app that carries a participant id, and it
 * names the person being judged rather than the sender. It is validated here for shape only:
 * whether that person actually holds the answer right is a question about the room, so the
 * domain answers it.
 *
 * `judge:submit` changes scores, and scores are add-only. A payload that fails validation is
 * therefore refused before the state is read, and a refused transition rebroadcasts so that
 * a host acting on a stale screen is pulled back in sync rather than retrying blindly.
 */

import type {
  ClientToServerEvents,
  JudgeNextAction,
  JudgeSubmitPayload,
  ServerToClientEvents,
} from '@quiz-world/shared';
import { JUDGE_NEXT_ACTIONS, validateScoreDelta } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyGameReset, applyJudge } from '../domain/judge';
import { isRecord } from '../guards';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession, type SocketSession } from './session';

export type JudgeHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  now: () => number;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Registers the host progression handlers on a newly connected socket. */
export function registerJudgeHandlers(
  socket: AppSocket,
  dependencies: JudgeHandlerDependencies,
): void {
  socket.on('judge:submit', (payload) => {
    handleJudgeSubmit(socket, dependencies, payload);
  });

  socket.on('game:reset', () => {
    handleGameReset(socket, dependencies);
  });
}

function handleJudgeSubmit(
  socket: AppSocket,
  dependencies: JudgeHandlerDependencies,
  payload: JudgeSubmitPayload,
): void {
  const session = requireSession(socket);
  if (session === undefined) {
    return;
  }

  const parsed = parseJudgePayload(payload);
  if (!parsed.ok) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: parsed.message });
    return;
  }

  const handle = dependencies.registry.find(session.tournamentId);
  if (handle === undefined) {
    emitError(socket, 'TOURNAMENT_NOT_FOUND');
    return;
  }

  const result = handle.update((current) =>
    applyJudge(current, {
      actorId: session.participantId,
      targetParticipantId: parsed.targetParticipantId,
      isCorrect: parsed.isCorrect,
      scoreDelta: parsed.scoreDelta,
      nextAction: parsed.nextAction,
      now: dependencies.now(),
    }),
  );

  if (!result.ok) {
    emitError(socket, result.code);
  }

  broadcastRoomState(dependencies.io, handle);
}

function handleGameReset(socket: AppSocket, dependencies: JudgeHandlerDependencies): void {
  const session = requireSession(socket);
  if (session === undefined) {
    return;
  }

  const handle = dependencies.registry.find(session.tournamentId);
  if (handle === undefined) {
    emitError(socket, 'TOURNAMENT_NOT_FOUND');
    return;
  }

  const result = handle.update((current) =>
    applyGameReset(current, {
      actorId: session.participantId,
      now: dependencies.now(),
    }),
  );

  if (!result.ok) {
    emitError(socket, result.code);
  }

  broadcastRoomState(dependencies.io, handle);
}

function requireSession(socket: AppSocket): SocketSession | undefined {
  const session = readSession(socket.data);
  if (session === undefined) {
    emitError(socket, 'INVALID_STATE');
    return undefined;
  }
  return session;
}

function emitError(socket: AppSocket, code: Parameters<typeof socketErrorMessage>[0]): void {
  socket.emit('error', { code, message: socketErrorMessage(code) });
}

type ParsedJudge =
  | {
      ok: true;
      targetParticipantId: string;
      isCorrect: boolean;
      scoreDelta: number;
      nextAction: JudgeNextAction;
    }
  | { ok: false; message: string };

function parseJudgePayload(payload: JudgeSubmitPayload): ParsedJudge {
  if (!isRecord(payload)) {
    return { ok: false, message: socketErrorMessage('VALIDATION_ERROR') };
  }

  const targetParticipantId = payload['participantId'];
  const isCorrect = payload['isCorrect'];
  const nextAction = payload['nextAction'];

  if (
    typeof targetParticipantId !== 'string' ||
    targetParticipantId === '' ||
    typeof isCorrect !== 'boolean' ||
    !isJudgeNextAction(nextAction)
  ) {
    return { ok: false, message: socketErrorMessage('VALIDATION_ERROR') };
  }

  const scoreDelta = validateScoreDelta(payload['scoreDelta']);
  if (!scoreDelta.ok) {
    return { ok: false, message: scoreDelta.message };
  }

  return {
    ok: true,
    targetParticipantId,
    isCorrect,
    scoreDelta: scoreDelta.value,
    nextAction,
  };
}

function isJudgeNextAction(value: unknown): value is JudgeNextAction {
  return JUDGE_NEXT_ACTIONS.some((action) => action === value);
}
