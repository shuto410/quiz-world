/**
 * Wiring of the HTTP and Socket.io server.
 *
 * Both protocols share one Node HTTP server, and in production one ALB target, because they
 * are one process by design: the socket connections and the REST endpoints operate on the
 * same in-memory game state.
 *
 * No CORS configuration is needed. In development Vite proxies `/api` and `/socket.io` to
 * this server, and in production CloudFront serves the SPA and this server from a single
 * origin, so the browser never makes a cross-origin request.
 */

import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import type { AppDependencies } from './app';
import { createApp } from './app';
import type { RoomRegistry } from './rooms/roomRegistry';
import type { SocketServer } from './socket/broadcast';

export type ServerDependencies = AppDependencies & {
  /**
   * Not used until connections start joining rooms, but taken here so that the server owns
   * exactly one registry and never reaches for a module-level singleton.
   */
  registry: RoomRegistry;
};

export type CreatedServer = {
  httpServer: HttpServer;
  io: SocketServer;
};

export function createServer(dependencies: ServerDependencies): CreatedServer {
  const { logger } = dependencies;
  const httpServer = createHttpServer(createApp(dependencies));
  const io: SocketServer = new SocketIoServer(httpServer);

  io.on('connection', (socket) => {
    const connectionLogger = logger.child({ socketId: socket.id });
    connectionLogger.debug('socket connected');

    socket.on('disconnect', (reason) => {
      connectionLogger.debug('socket disconnected', { reason });
    });
  });

  return { httpServer, io };
}

/** Starts listening and resolves once the port is bound. */
export async function listen(httpServer: HttpServer, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, resolve);
  });
}

/**
 * Stops accepting work and waits for the process to be able to exit.
 *
 * ECS sends SIGTERM and then kills the task, so disconnecting sockets explicitly is what
 * lets clients start reconnecting immediately instead of waiting for a timeout.
 */
export async function shutdown({ io }: CreatedServer): Promise<void> {
  // Closing the Socket.io server also closes the HTTP server it was attached to.
  await io.close();
}
