/**
 * Binds takeover authority and delivery channels in the same turn as the pure transition.
 * No I/O can yield between choosing the new host and restricting the answer to that socket.
 */
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyHostClaim } from '../domain/host';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
import type { Connections } from './connections';
import { socketErrorMessage } from './errorMessages';
import { readSession } from './session';

/** Services for host authority and role-specific broadcasting. */
export type HostHandlerDependencies = {
  io: SocketServer;
  registry: RoomRegistry;
  connections: Connections;
  now: () => number;
};

export function registerHostHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  dependencies: HostHandlerDependencies,
): void {
  socket.on('host:claim', (_payload, ack) => {
    const session = readSession(socket.data);
    if (session === undefined) {
      ack({ ok: false, code: 'INVALID_STATE', message: socketErrorMessage('INVALID_STATE') });
      return;
    }
    const handle = dependencies.registry.find(session.tournamentId);
    if (handle === undefined) {
      ack({
        ok: false,
        code: 'TOURNAMENT_NOT_FOUND',
        message: socketErrorMessage('TOURNAMENT_NOT_FOUND'),
      });
      return;
    }
    const result = handle.update((current) =>
      applyHostClaim(current, session.participantId, dependencies.now()),
    );
    if (!result.ok) {
      ack({ ok: false, code: result.code, message: socketErrorMessage(result.code) });
      broadcastRoomState(dependencies.io, handle);
      return;
    }
    dependencies.connections.bind(socket, { ...session, role: 'host' });
    ack({ ok: true, hostId: session.participantId });
    broadcastRoomState(dependencies.io, handle);
  });
}
