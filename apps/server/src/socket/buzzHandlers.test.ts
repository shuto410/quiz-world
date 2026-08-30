/**
 * Integration tests for `game:buzz` over a real Socket.io server.
 *
 * These pin the contract the play screen depends on: presses from two joined clients land in
 * the same order on every connection, a refused press gets an `error` without inventing a
 * new order, and the actor is never taken from the payload.
 */

import type { Server as HttpServer } from 'node:http';
import type {
  ClientToServerEvents,
  JoinResponse,
  RoomStateEvent,
  ServerToClientEvents,
  SocketErrorEvent,
} from '@quiz-world/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createServer, listen, shutdown, type CreatedServer } from '../server';
import { createTestAppDependencies, TEST_NOW } from '../testing/appDependencies';
import { createTournament } from '../tournaments/createTournament';

type AppClient = Socket<ServerToClientEvents, ClientToServerEvents>;

let running: CreatedServer | undefined;
const clients: AppClient[] = [];

function boundPort(httpServer: HttpServer): number {
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  return address.port;
}

async function startTestServer(): Promise<{
  baseUrl: string;
  dependencies: ReturnType<typeof createTestAppDependencies>;
}> {
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
    now: () => TEST_NOW,
  });
  await listen(server.httpServer, 0);
  running = server;
  return {
    baseUrl: `http://127.0.0.1:${boundPort(server.httpServer)}`,
    dependencies,
  };
}

function openClient(baseUrl: string): Promise<AppClient> {
  const client = connect(baseUrl, { transports: ['websocket'] }) as AppClient;
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => {
      resolve(client);
    });
    client.once('connect_error', reject);
  });
}

function emitHostJoin(
  client: AppClient,
  payload: Parameters<ClientToServerEvents['tournament:host-join']>[0],
): Promise<JoinResponse> {
  return new Promise((resolve) => {
    client.emit('tournament:host-join', payload, resolve);
  });
}

function emitParticipantJoin(
  client: AppClient,
  payload: Parameters<ClientToServerEvents['tournament:join']>[0],
): Promise<JoinResponse> {
  return new Promise((resolve) => {
    client.emit('tournament:join', payload, resolve);
  });
}

function nextRoomState(client: AppClient): Promise<RoomStateEvent> {
  return new Promise((resolve) => {
    client.once('room:state', resolve);
  });
}

function nextError(client: AppClient): Promise<SocketErrorEvent> {
  return new Promise((resolve) => {
    client.once('error', resolve);
  });
}

afterEach(async () => {
  for (const client of clients) {
    client.disconnect();
  }
  clients.length = 0;
  if (running) {
    await shutdown(running);
    running = undefined;
  }
});

async function seedRoom(baseUrl: string, hostToken: string, tournamentId: string) {
  const host = await openClient(baseUrl);
  const hostJoined = nextRoomState(host);
  await emitHostJoin(host, { tournamentId, hostToken });
  await hostJoined;

  const first = await openClient(baseUrl);
  const firstForHost = nextRoomState(host);
  const firstJoined = nextRoomState(first);
  const firstAck = await emitParticipantJoin(first, {
    tournamentId,
    displayName: '太郎',
  });
  await Promise.all([firstForHost, firstJoined]);

  const second = await openClient(baseUrl);
  const secondForHost = nextRoomState(host);
  const secondForFirst = nextRoomState(first);
  const secondJoined = nextRoomState(second);
  const secondAck = await emitParticipantJoin(second, {
    tournamentId,
    displayName: '花子',
  });
  await Promise.all([secondForHost, secondForFirst, secondJoined]);

  expect(firstAck.ok).toBe(true);
  expect(secondAck.ok).toBe(true);
  if (!firstAck.ok || !secondAck.ok) {
    throw new Error('seed join failed');
  }

  return {
    host,
    first,
    second,
    firstId: firstAck.participantId,
    secondId: secondAck.participantId,
  };
}

describe('buzz handlers', () => {
  it('records two presses in receive order and syncs that order to every client', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: '早押し同期大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const { host, first, second, firstId, secondId } = await seedRoom(
      baseUrl,
      created.response.hostToken,
      created.response.tournament.id,
    );

    const hostSeesFirst = nextRoomState(host);
    const firstSeesOwn = nextRoomState(first);
    const secondSeesFirst = nextRoomState(second);
    first.emit('game:buzz', {});
    const afterFirst = await Promise.all([hostSeesFirst, firstSeesOwn, secondSeesFirst]);

    for (const state of afterFirst) {
      expect(state.status).toBe('answering');
      expect(state.currentResponderId).toBe(firstId);
      expect(state.currentBuzzSession).toEqual({ id: 'buzz-session-1', startedAt: TEST_NOW });
      expect(state.buzzOrder).toEqual([{ participantId: firstId, receivedAt: TEST_NOW }]);
    }

    const hostSeesSecond = nextRoomState(host);
    const firstSeesSecond = nextRoomState(first);
    const secondSeesOwn = nextRoomState(second);
    second.emit('game:buzz', {});
    const afterSecond = await Promise.all([hostSeesSecond, firstSeesSecond, secondSeesOwn]);

    for (const state of afterSecond) {
      expect(state.currentResponderId).toBe(firstId);
      expect(state.buzzOrder).toEqual([
        { participantId: firstId, receivedAt: TEST_NOW },
        { participantId: secondId, receivedAt: TEST_NOW },
      ]);
    }
  });

  it('rejects a double press with an error and does not change the order', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: '二重押し大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const { first, second } = await seedRoom(
      baseUrl,
      created.response.hostToken,
      created.response.tournament.id,
    );

    const opened = nextRoomState(first);
    first.emit('game:buzz', {});
    const openedState = await opened;
    expect(openedState.buzzOrder).toHaveLength(1);

    const errorPromise = nextError(first);
    const firstResync = nextRoomState(first);
    const secondResync = nextRoomState(second);
    first.emit('game:buzz', {});
    const [error, resync, otherView] = await Promise.all([errorPromise, firstResync, secondResync]);

    expect(error).toEqual({
      code: 'INVALID_STATE',
      message: '現在の状態ではその操作はできません',
    });
    // Refusal rebroadcasts the same order so a stale client is pulled back in sync.
    expect(resync.buzzOrder).toEqual(openedState.buzzOrder);
    expect(otherView.buzzOrder).toEqual(openedState.buzzOrder);
  });

  it('rejects a buzz from the host seat', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: 'ホスト押下大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const { host } = await seedRoom(
      baseUrl,
      created.response.hostToken,
      created.response.tournament.id,
    );

    const errorPromise = nextError(host);
    const resyncPromise = nextRoomState(host);
    host.emit('game:buzz', {});
    const [error, resync] = await Promise.all([errorPromise, resyncPromise]);

    expect(error.code).toBe('INVALID_STATE');
    expect(resync.status).toBe('idle');
    expect(resync.buzzOrder).toEqual([]);
  });

  it('rejects a buzz before join without inventing a room', async () => {
    const { baseUrl } = await startTestServer();
    const stranger = await openClient(baseUrl);

    const errorPromise = nextError(stranger);
    stranger.emit('game:buzz', {});
    await expect(errorPromise).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });
});
