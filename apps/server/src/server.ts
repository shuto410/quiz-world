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
import { createSnapshotLifecycle, type SnapshotLifecycle } from './snapshots/lifecycle';
import type { SnapshotRepository } from './snapshots/repository';
import type { RoomRegistry } from './rooms/roomRegistry';
import { registerAnswerHandlers } from './socket/answerHandlers';
import type { SocketServer } from './socket/broadcast';
import { registerBuzzHandlers } from './socket/buzzHandlers';
import { registerFinishHandlers } from './socket/finishHandlers';
import { createConnections } from './socket/connections';
import { registerRequestMiddleware } from './socket/requestMiddleware';
import type { RateLimitOverrides } from './socket/rateLimit';
import { registerJoinHandlers } from './socket/joinHandlers';
import { registerRenameHandlers } from './socket/renameHandlers';
import { registerHostHandlers } from './socket/hostHandlers';
import { registerJudgeHandlers } from './socket/judgeHandlers';

export type ServerDependencies = AppDependencies & {
  /**
   * Owned here so handlers never reach for a module-level singleton. The same registry is
   * what snapshot recovery rehydrates into.
   */
  registry: RoomRegistry;
  /** Durable recovery storage; omitted only by tests that exercise transport in isolation. */
  snapshots?: SnapshotRepository;
  /** Overrides the loose MVP per-event limits without changing handlers. */
  rateLimits?: RateLimitOverrides;
  /** Fresh participant ids for first-time joins. Injected so tests can pin them. */
  newParticipantId: () => string;
  /** Fresh buzz-session ids when the first press of a round opens one. */
  newBuzzSessionId: () => string;
};

export type CreatedServer = {
  httpServer: HttpServer;
  io: SocketServer;
  persistence?: SnapshotLifecycle;
};

export function createServer(dependencies: ServerDependencies): CreatedServer {
  const { logger, registry, repository, newParticipantId, newBuzzSessionId, now } = dependencies;
  const httpServer = createHttpServer(createApp(dependencies));
  const io: SocketServer = new SocketIoServer(httpServer);

  const connections = createConnections();
  const persistence =
    dependencies.snapshots === undefined
      ? undefined
      : createSnapshotLifecycle({
          registry,
          snapshots: dependencies.snapshots,
          repository,
          logger,
          now,
        });

  io.on('connection', (socket) => {
    const connectionLogger = logger.child({ socketId: socket.id });
    connectionLogger.debug('socket connected');

    registerRequestMiddleware(socket, { connections, now, rateLimits: dependencies.rateLimits });

    registerJoinHandlers(socket, {
      connections,
      io,
      registry,
      repository,
      persistence,
      newParticipantId,
      now,
      logger: connectionLogger,
    });

    registerHostHandlers(socket, { io, registry, connections, now });
    registerRenameHandlers(socket, { io, registry, now });

    registerBuzzHandlers(socket, {
      io,
      registry,
      newBuzzSessionId,
      now,
    });

    registerAnswerHandlers(socket, {
      io,
      registry,
      now,
    });

    registerJudgeHandlers(socket, {
      io,
      registry,
      now,
    });

    registerFinishHandlers(socket, {
      io,
      registry,
      repository,
      persistence,
      now,
      logger: connectionLogger,
    });

    socket.on('disconnect', (reason) => {
      connectionLogger.debug('socket disconnected', { reason });
    });
  });

  return { httpServer, io, persistence };
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
export async function shutdown({ io, persistence }: CreatedServer): Promise<void> {
  // Closing the Socket.io server also closes the HTTP server it was attached to.
  await io.close();
  await persistence?.shutdown();
}
