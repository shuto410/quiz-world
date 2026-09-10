/**
 * Socket handlers for ending a tournament and closing its room.
 *
 * `tournament:finish` is the one gameplay operation with a database write behind it. The
 * order is deliberate: the room finishes first and is broadcast, and only then is the
 * finished snapshot flushed and the tournament marked closed in DynamoDB. The memory state is what the game is played against,
 * so a database hiccup must not be able to refuse the host's decision to end the tournament.
 *
 * The cost of that order is a window where the room has finished and the stored status still
 * says active. `applyParticipantJoin` therefore refuses newcomers on the room status as well,
 * so the window cannot be walked through with an invite code.
 *
 * `room:close` is the end of the room's life on this server: everyone is told, everyone is
 * disconnected, and the registry gives up ownership. It is refused unless the tournament has
 * finished, so it cannot be used to end a game in progress.
 */

import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyTournamentFinish, checkRoomClose } from '../domain/finish';
import type { Logger } from '../logger';
import type { SnapshotLifecycle } from '../snapshots/lifecycle';
import type { RoomRegistry } from '../rooms/roomRegistry';
import type { TournamentRepository } from '../tournaments/repository';
import {
  broadcastRoomState,
  hostChannel,
  participantChannel,
  type SocketServer,
} from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession, type SocketSession } from './session';

export type FinishHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  persistence?: SnapshotLifecycle;
  repository: TournamentRepository;
  now: () => number;
  logger: Logger;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Registers the tournament-ending handlers on a newly connected socket. */
export function registerFinishHandlers(
  socket: AppSocket,
  dependencies: FinishHandlerDependencies,
): void {
  socket.on('tournament:finish', () => {
    void handleFinish(socket, dependencies);
  });

  socket.on('room:close', () => {
    void handleRoomClose(socket, dependencies);
  });
}

async function handleFinish(
  socket: AppSocket,
  dependencies: FinishHandlerDependencies,
): Promise<void> {
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
    applyTournamentFinish(current, {
      actorId: session.participantId,
      now: dependencies.now(),
    }),
  );

  if (!result.ok) {
    emitError(socket, result.code);
    broadcastRoomState(dependencies.io, handle);
    return;
  }

  broadcastRoomState(dependencies.io, handle);

  try {
    await dependencies.persistence?.flush(session.tournamentId);
    await dependencies.repository.updateStatus(session.tournamentId, 'closed', dependencies.now());
  } catch (error: unknown) {
    // The tournament is over either way. Logged rather than surfaced, because there is
    // nothing the host could do with the information and a retry would now be refused.
    dependencies.logger.error('failed to mark the tournament closed', {
      error,
      tournamentId: session.tournamentId,
    });
  }
}

async function handleRoomClose(
  socket: AppSocket,
  dependencies: FinishHandlerDependencies,
): Promise<void> {
  const session = requireSession(socket);
  if (session === undefined) {
    return;
  }

  const { io, registry } = dependencies;
  const handle = registry.find(session.tournamentId);
  if (handle === undefined) {
    emitError(socket, 'TOURNAMENT_NOT_FOUND');
    return;
  }

  const allowed = checkRoomClose(handle.read(), session.participantId);
  if (!allowed.ok) {
    emitError(socket, allowed.code);
    broadcastRoomState(io, handle);
    return;
  }

  try {
    await dependencies.repository.updateStatus(session.tournamentId, 'closed', dependencies.now());
    await dependencies.persistence?.remove(session.tournamentId);
  } catch (error: unknown) {
    dependencies.logger.error('failed to close room', {
      error,
      tournamentId: session.tournamentId,
    });
    emitError(socket, 'INTERNAL_ERROR');
    return;
  }

  // Another close may have completed while storage was pending.
  if (registry.find(session.tournamentId) === undefined) return;

  registry.release(session.tournamentId);
  const channels = [hostChannel(session.tournamentId), participantChannel(session.tournamentId)];
  for (const channel of channels) {
    io.to(channel).emit('room:closed', { reason: 'hostClosed' });
  }
  for (const channel of channels) {
    void io.in(channel).disconnectSockets();
  }

  dependencies.logger.info('room closed by host', { tournamentId: session.tournamentId });
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
