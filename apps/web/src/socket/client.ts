/**
 * Construction of the typed Socket.io client.
 *
 * The browser always connects to the same origin. In development Vite proxies `/socket.io`
 * to the socket server; in production CloudFront does the same split. Either way the client
 * never embeds a host name, which is what lets the invite URL's domain change without a
 * client rebuild for the socket path.
 *
 * Reconnection is left on with unbounded attempts. A quiz room survives brief network
 * blips, and the server is the source of truth for state: on reconnect the next `room:state`
 * overwrites whatever the UI was showing. Connecting itself is deferred (`autoConnect:
 * false`) until a screen actually needs the socket, so opening the create form does not
 * open a websocket.
 */

import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';

/** Socket typed with the shared event contracts. */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Options every socket in this app is created with.
 *
 * Exported so the settings can be asserted in tests without spinning up a real connection.
 */
export const SOCKET_CLIENT_OPTIONS = {
  /**
   * Screens call `connect()` when they enter a room. Creating a tournament does not need a
   * socket, so the default is off.
   */
  autoConnect: false,
  /** Transient drops during a match should come back without the user refreshing. */
  reconnection: true,
  /** Keep trying: a mid-match outage should recover when the network returns. */
  reconnectionAttempts: Number.POSITIVE_INFINITY,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  /**
   * Prefer WebSocket after the first handshake. Polling stays as a fallback for networks
   * that block the upgrade.
   */
  transports: ['websocket', 'polling'],
} as const satisfies Partial<ManagerOptions & SocketOptions>;

export type CreateSocketOptions = {
  /** Override for tests. Defaults to the current origin. */
  url?: string;
};

/** Creates a disconnected socket ready for a screen to call `connect()` on. */
export function createSocket(options: CreateSocketOptions = {}): AppSocket {
  return io(options.url ?? '/', { ...SOCKET_CLIENT_OPTIONS });
}
