/**
 * Socket handler for `answer:submit`.
 *
 * Same shape as the buzz handler: the actor comes from the socket session, the transition is
 * the synchronous `applyAnswerSubmit`, and state leaves only through `broadcastRoomState()`.
 * Participants get the converted view there, so an answer that has not been judged reaches
 * the host and nobody else — that conversion is the whole reason this handler may not emit
 * state itself.
 *
 * A refused submission still triggers a broadcast, for the same reason a refused buzz does:
 * a client that acted on a stale view is pulled back in sync. A payload that fails
 * validation does not, because nothing about the room has changed and the sender's own input
 * is what needs fixing.
 */

import type {
  AnswerSubmitPayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@quiz-world/shared';
import { validateAnswerText } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyAnswerSubmit } from '../domain/answer';
import { isRecord } from '../guards';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession } from './session';

export type AnswerHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  now: () => number;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Registers the answer handler on a newly connected socket. */
export function registerAnswerHandlers(
  socket: AppSocket,
  dependencies: AnswerHandlerDependencies,
): void {
  socket.on('answer:submit', (payload) => {
    handleAnswerSubmit(socket, dependencies, payload);
  });
}

function handleAnswerSubmit(
  socket: AppSocket,
  dependencies: AnswerHandlerDependencies,
  payload: AnswerSubmitPayload,
): void {
  const session = readSession(socket.data);
  if (session === undefined) {
    socket.emit('error', {
      code: 'INVALID_STATE',
      message: socketErrorMessage('INVALID_STATE'),
    });
    return;
  }

  const answerText = validateAnswerText(isRecord(payload) ? payload['answerText'] : undefined);
  if (!answerText.ok) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: answerText.message });
    return;
  }

  const handle = dependencies.registry.find(session.tournamentId);
  if (handle === undefined) {
    socket.emit('error', {
      code: 'TOURNAMENT_NOT_FOUND',
      message: socketErrorMessage('TOURNAMENT_NOT_FOUND'),
    });
    return;
  }

  const result = handle.update((current) =>
    applyAnswerSubmit(current, {
      participantId: session.participantId,
      answerText: answerText.value,
      now: dependencies.now(),
    }),
  );

  if (!result.ok) {
    socket.emit('error', {
      code: result.code,
      message: socketErrorMessage(result.code),
    });
  }

  broadcastRoomState(dependencies.io, handle);
}
