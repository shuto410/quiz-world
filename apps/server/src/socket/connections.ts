/**
 * Tracks the current transport for each seat outside game state. Replacement is synchronous
 * with session binding; an invalidated transport can neither act nor mark its successor offline.
 * Channel operations use the synchronous in-memory adapter required by the single-server design.
 */
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import { hostChannel, participantChannel } from './broadcast';
import { bindSession, type SocketSession } from './session';

/** The server-side transport carrying a joined seat. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
/** Per-server connection ownership, separate from serializable room state. */
export type Connections = ReturnType<typeof createConnections>;

export function createConnections() {
  const seats = new Map<string, AppSocket>();
  const invalidated = new WeakSet<AppSocket>();
  const key = (session: SocketSession) =>
    JSON.stringify([session.tournamentId, session.participantId]);
  return {
    isInvalidated: (socket: AppSocket) => invalidated.has(socket),
    bind: (socket: AppSocket, session: SocketSession) => {
      const previous = seats.get(key(session));
      if (previous !== undefined && previous !== socket) {
        invalidated.add(previous);
        void previous.leave(hostChannel(session.tournamentId));
        void previous.leave(participantChannel(session.tournamentId));
        previous.emit('session:invalidated', {});
      }
      seats.set(key(session), socket);
      bindSession(socket.data as Record<string, unknown>, session);
      void socket.join(
        session.role === 'host'
          ? hostChannel(session.tournamentId)
          : participantChannel(session.tournamentId),
      );
    },
    release: (socket: AppSocket, session: SocketSession) => {
      if (seats.get(key(session)) !== socket) return false;
      seats.delete(key(session));
      return true;
    },
  };
}
