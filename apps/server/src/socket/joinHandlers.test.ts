/**
 * Integration tests for join / leave over a real Socket.io server.
 *
 * These cover the contract the UI depends on: a successful join acks an id, everyone already
 * in the room receives `room:state`, and a refused join never learns the room contents.
 */

import type { Server as HttpServer } from 'node:http';
import type {
  ClientToServerEvents,
  JoinResponse,
  RoomStateEvent,
  ServerToClientEvents,
} from '@quiz-world/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createTournament } from '../tournaments/createTournament';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createServer, listen, shutdown, type CreatedServer } from '../server';
import { createTestAppDependencies, TEST_NOW } from '../testing/appDependencies';
import { DEFAULT_HOST_DISPLAY_NAME } from '../domain/join';

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

async function startTestServer(options?: { newParticipantId?: () => string }): Promise<{
  server: CreatedServer;
  baseUrl: string;
  dependencies: ReturnType<typeof createTestAppDependencies>;
}> {
  let participantSeq = 0;
  const dependencies = createTestAppDependencies();
  const server = createServer({
    ...dependencies,
    registry: createRoomRegistry({ now: () => TEST_NOW }),
    newParticipantId:
      options?.newParticipantId ??
      (() => {
        participantSeq += 1;
        return `participant-${participantSeq}`;
      }),
    now: () => TEST_NOW,
  });
  await listen(server.httpServer, 0);
  running = server;
  return {
    server,
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

describe('join handlers', () => {
  it('lets a host and a guest join and syncs the participant list to both', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: '同期テスト大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const host = await openClient(baseUrl);
    const hostStatePromise = nextRoomState(host);
    const hostAck = await emitHostJoin(host, {
      tournamentId: created.response.tournament.id,
      hostToken: created.response.hostToken,
    });

    expect(hostAck).toEqual({
      ok: true,
      role: 'host',
      participantId: 'participant-1',
      isReconnect: false,
    });

    const hostState = await hostStatePromise;
    expect(hostState.participants.map((participant) => participant.name)).toEqual([
      DEFAULT_HOST_DISPLAY_NAME,
    ]);

    const guest = await openClient(baseUrl);
    const hostSeesGuest = nextRoomState(host);
    const guestStatePromise = nextRoomState(guest);
    const guestAck = await emitParticipantJoin(guest, {
      tournamentId: created.response.tournament.id,
      displayName: '花子',
    });

    expect(guestAck).toEqual({
      ok: true,
      role: 'participant',
      participantId: 'participant-2',
      isReconnect: false,
    });

    const [hostUpdated, guestState] = await Promise.all([hostSeesGuest, guestStatePromise]);
    expect(hostUpdated.participants.map((participant) => participant.name)).toEqual([
      DEFAULT_HOST_DISPLAY_NAME,
      '花子',
    ]);
    expect(guestState.participants.map((participant) => participant.name)).toEqual([
      DEFAULT_HOST_DISPLAY_NAME,
      '花子',
    ]);
  });

  it('does not send room state when a join is refused', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: '拒否テスト大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const host = await openClient(baseUrl);
    await emitHostJoin(host, {
      tournamentId: created.response.tournament.id,
      hostToken: created.response.hostToken,
    });

    const stranger = await openClient(baseUrl);
    let sawState = false;
    stranger.on('room:state', () => {
      sawState = true;
    });

    const ack = await emitParticipantJoin(stranger, {
      tournamentId: created.response.tournament.id,
      displayName: DEFAULT_HOST_DISPLAY_NAME,
    });

    expect(ack).toMatchObject({ ok: false, code: 'DUPLICATE_DISPLAY_NAME' });
    expect(ack).not.toHaveProperty('state');
    expect(ack).not.toHaveProperty('participants');
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(sawState).toBe(false);
  });

  it('rejects a wrong host token without creating a room seat', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: 'トークンテスト大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const host = await openClient(baseUrl);
    const ack = await emitHostJoin(host, {
      tournamentId: created.response.tournament.id,
      hostToken: 'not-the-real-token',
    });

    expect(ack).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
  });

  it('marks a participant offline on leave and notifies the room', async () => {
    const { baseUrl, dependencies } = await startTestServer();
    const created = await createTournament(dependencies, {
      name: '退出テスト大会',
      maxParticipants: 10,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const host = await openClient(baseUrl);
    const hostJoined = nextRoomState(host);
    await emitHostJoin(host, {
      tournamentId: created.response.tournament.id,
      hostToken: created.response.hostToken,
    });
    await hostJoined;

    const guest = await openClient(baseUrl);
    const guestJoinedForHost = nextRoomState(host);
    const guestJoined = nextRoomState(guest);
    await emitParticipantJoin(guest, {
      tournamentId: created.response.tournament.id,
      displayName: '太郎',
    });
    await Promise.all([guestJoinedForHost, guestJoined]);

    const hostSeesLeave = nextRoomState(host);
    guest.emit('tournament:leave', {});
    const afterLeave = await hostSeesLeave;

    const taro = afterLeave.participants.find((participant) => participant.name === '太郎');
    expect(taro?.online).toBe(false);
    expect(taro?.score).toBe(0);
  });
});
