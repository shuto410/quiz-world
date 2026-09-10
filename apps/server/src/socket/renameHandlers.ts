/** Resolves rename authority from the socket session and broadcasts only the converted room views. */
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import { validateDisplayName } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { applyRename } from '../domain/rename';
import { isRecord } from '../guards';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { broadcastRoomState, type SocketServer } from './broadcast';
import { socketErrorMessage } from './errorMessages';
import { readSession } from './session';
/** State ownership, transport and wall clock for a rename request. */
type RenameDependencies = { io: SocketServer; registry: RoomRegistry; now: () => number };
export function registerRenameHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  dependencies: RenameDependencies,
): void {
  socket.on('participant:rename', (payload, ack) => {
    const session = readSession(socket.data);
    if (session === undefined) {
      ack({ ok: false, code: 'INVALID_STATE', message: socketErrorMessage('INVALID_STATE') });
      return;
    }
    const name = validateDisplayName(isRecord(payload) ? payload['displayName'] : undefined);
    if (!name.ok) {
      ack({ ok: false, code: 'VALIDATION_ERROR', message: name.message });
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
      applyRename(current, session.participantId, name.value, dependencies.now()),
    );
    if (result.ok) ack({ ok: true, displayName: name.value });
    else ack({ ok: false, code: result.code, message: socketErrorMessage(result.code) });
    broadcastRoomState(dependencies.io, handle);
  });
}
