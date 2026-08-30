/**
 * Socket handler for the buzzer.
 *
 * The actor is taken from the socket session, never from the payload. The transition itself
 * is the synchronous `applyBuzz` from the domain layer; this module only does the I/O around
 * it — look up the room, stamp a session id and receive time, emit an error on refusal, and
 * broadcast through `broadcastRoomState()`. Nothing awaits between reading and writing the
 * room state, which is what keeps two near-simultaneous presses ordered.
 *
 * Refused presses still get a fresh `room:state`. A client that pressed on a stale view is
 * pulled back in sync instead of being left to guess why the buzzer did nothing.
 */

import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyBuzz } from '../domain/buzz';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession } from './session';

export type BuzzHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  newBuzzSessionId: () => string;
  now: () => number;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Registers the buzzer handler on a newly connected socket. */
export function registerBuzzHandlers(
  socket: AppSocket,
  dependencies: BuzzHandlerDependencies,
): void {
  socket.on('game:buzz', () => {
    handleBuzz(socket, dependencies);
  });
}

function handleBuzz(socket: AppSocket, dependencies: BuzzHandlerDependencies): void {
  const session = readSession(socket.data);
  if (session === undefined) {
    socket.emit('error', {
      code: 'INVALID_STATE',
      message: socketErrorMessage('INVALID_STATE'),
    });
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
    applyBuzz(current, {
      participantId: session.participantId,
      newBuzzSessionId: dependencies.newBuzzSessionId(),
      now: dependencies.now(),
    }),
  );

  if (!result.ok) {
    socket.emit('error', {
      code: result.code,
      message: socketErrorMessage(result.code),
    });
    broadcastRoomState(dependencies.io, handle);
    return;
  }

  broadcastRoomState(dependencies.io, handle);
}
