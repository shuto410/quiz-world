/**
 * A real Socket.io server, a real tournament and three connected clients.
 *
 * Gameplay handlers are worth testing over an actual socket rather than by calling the
 * handler function: what they are responsible for is the wiring — that the actor comes from
 * the session, that the host and the participants sit in different channels, and that every
 * connection ends up with the view its role is allowed to see. A stubbed socket would let
 * all three of those break silently.
 *
 * Timestamps and generated ids are fixed, so tests can assert exact values instead of
 * matching shapes. Not part of the running server; it lives under `src` to share the same
 * TypeScript settings as the code it supports.
 */

import type { RateLimitOverrides } from '../socket/rateLimit';
import type { Server as HttpServer } from 'node:http';
import type {
  ClientToServerEvents,
  JoinResponse,
  RoomStateEvent,
  ServerToClientEvents,
  SocketErrorEvent,
} from '@quiz-world/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createServer, listen, shutdown, type CreatedServer } from '../server';
import { createTournament } from '../tournaments/createTournament';
import { createTestAppDependencies, TEST_NOW, type TestAppDependencies } from './appDependencies';

/** A browser-side socket, typed with the event maps the other way round. */
export type AppClient = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A room with a host and two participants, all joined and in sync. */
export type SeededRoom = {
  tournamentId: string;
  hostToken: string;
  host: AppClient;
  first: AppClient;
  second: AppClient;
  firstId: string;
  secondId: string;
};

export type SocketTestHarness = {
  baseUrl: string;
  dependencies: TestAppDependencies;
  openClient: () => Promise<AppClient>;
  /**
   * Creates a tournament and joins a host plus two participants, waiting for every resulting
   * broadcast so that a following assertion cannot pick up a join event by mistake.
   */
  seedRoom: (tournamentName: string) => Promise<SeededRoom>;
  stop: () => Promise<void>;
};

/** Optional narrow limits and clock make middleware boundaries observable over real sockets. */
type HarnessOptions = { rateLimits?: RateLimitOverrides; now?: () => number };

export async function startSocketTestHarness(
  options: HarnessOptions = {},
): Promise<SocketTestHarness> {
  let participantSeq = 0;
  let buzzSessionSeq = 0;
  const dependencies = createTestAppDependencies();
  const server = createServer({
    ...dependencies,
    registry: createRoomRegistry({ now: () => TEST_NOW }),
    newParticipantId: () => {
      participantSeq += 1;
      return `participant-${participantSeq}`;
    },
    newBuzzSessionId: () => {
      buzzSessionSeq += 1;
      return `buzz-session-${buzzSessionSeq}`;
    },
    now: options.now ?? (() => TEST_NOW),
    rateLimits: options.rateLimits,
  });
  await listen(server.httpServer, 0);

  const clients: AppClient[] = [];
  const baseUrl = `http://127.0.0.1:${boundPort(server.httpServer)}`;

  const openClient = () => {
    const client = connect(baseUrl, { transports: ['websocket'] }) as AppClient;
    clients.push(client);
    return new Promise<AppClient>((resolve, reject) => {
      client.once('connect', () => {
        resolve(client);
      });
      client.once('connect_error', reject);
    });
  };

  return {
    baseUrl,
    dependencies,
    openClient,
    seedRoom: (tournamentName) => seedRoom(dependencies, openClient, tournamentName),
    stop: () => stopAll(clients, server),
  };
}

/** Resolves with the next state broadcast this client receives. */
export function nextRoomState(client: AppClient): Promise<RoomStateEvent> {
  return new Promise((resolve) => {
    client.once('room:state', resolve);
  });
}

/** Resolves with the next refusal this client receives. */
export function nextError(client: AppClient): Promise<SocketErrorEvent> {
  return new Promise((resolve) => {
    client.once('error', resolve);
  });
}

export function emitHostJoin(
  client: AppClient,
  payload: Parameters<ClientToServerEvents['tournament:host-join']>[0],
): Promise<JoinResponse> {
  return new Promise((resolve) => {
    client.emit('tournament:host-join', payload, resolve);
  });
}

export function emitParticipantJoin(
  client: AppClient,
  payload: Parameters<ClientToServerEvents['tournament:join']>[0],
): Promise<JoinResponse> {
  return new Promise((resolve) => {
    client.emit('tournament:join', payload, resolve);
  });
}

async function seedRoom(
  dependencies: TestAppDependencies,
  openClient: () => Promise<AppClient>,
  tournamentName: string,
): Promise<SeededRoom> {
  const created = await createTournament(dependencies, {
    name: tournamentName,
    maxParticipants: 10,
  });
  if (!created.ok) {
    throw new Error(`could not create the test tournament: ${created.code}`);
  }
  const tournamentId = created.response.tournament.id;
  const hostToken = created.response.hostToken;

  const host = await openClient();
  const hostJoined = nextRoomState(host);
  await emitHostJoin(host, { tournamentId, hostToken });
  await hostJoined;

  const first = await openClient();
  const firstForHost = nextRoomState(host);
  const firstJoined = nextRoomState(first);
  const firstAck = await emitParticipantJoin(first, { tournamentId, displayName: '太郎' });
  await Promise.all([firstForHost, firstJoined]);

  const second = await openClient();
  const secondForHost = nextRoomState(host);
  const secondForFirst = nextRoomState(first);
  const secondJoined = nextRoomState(second);
  const secondAck = await emitParticipantJoin(second, { tournamentId, displayName: '花子' });
  await Promise.all([secondForHost, secondForFirst, secondJoined]);

  if (!firstAck.ok || !secondAck.ok) {
    throw new Error('a seeded participant could not join');
  }

  return {
    tournamentId,
    hostToken,
    host,
    first,
    second,
    firstId: firstAck.participantId,
    secondId: secondAck.participantId,
  };
}

async function stopAll(clients: AppClient[], server: CreatedServer): Promise<void> {
  for (const client of clients) {
    client.disconnect();
  }
  clients.length = 0;
  await shutdown(server);
}

function boundPort(httpServer: HttpServer): number {
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  return address.port;
}
