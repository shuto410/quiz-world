/** Full server restarts exercise the real DynamoDB snapshots and Socket.io admission boundary. */
import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { io as connect } from 'socket.io-client';
import { createServer, listen, shutdown, type CreatedServer } from '../server';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createTestAppDependencies } from '../testing/appDependencies';
import { startTestDynamoDb, type TestDynamoDb } from '../testing/testDynamoDb';
import {
  emitHostJoin,
  emitParticipantJoin,
  nextRoomState,
  nextError,
  type AppClient,
} from '../testing/socketTestHarness';
import { createTournament } from '../tournaments/createTournament';
import { createDynamoTournamentRepository } from '../tournaments/dynamoRepository';
import { createDynamoSnapshotRepository } from './dynamoRepository';
let db: TestDynamoDb | undefined;
let server: CreatedServer | undefined;
const clients: AppClient[] = [];
afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients.length = 0;
  if (server !== undefined) await shutdown(server);
  server = undefined;
  await db?.stop();
});
async function setup() {
  db = await startTestDynamoDb();
  const dependencies = {
    ...createTestAppDependencies(),
    now: () => Date.now(),
    repository: createDynamoTournamentRepository({
      client: db.documentClient,
      tableName: db.tournamentsTable,
    }),
  };
  const snapshots = createDynamoSnapshotRepository({
    client: db.documentClient,
    tableName: db.snapshotsTable,
    now: () => Date.now(),
  });
  async function start() {
    server = createServer({
      ...dependencies,
      snapshots,
      registry: createRoomRegistry({ now: () => Date.now() }),
      newParticipantId: randomUUID,
      newBuzzSessionId: randomUUID,
    });
    await listen(server.httpServer, 0);
    const address = server.httpServer.address();
    if (address === null || typeof address === 'string') throw new Error('missing port');
    const url = `http://127.0.0.1:${address.port}`;
    return async () => {
      const client: AppClient = connect(url, { transports: ['websocket'], reconnection: false });
      clients.push(client);
      await new Promise<void>((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      return client;
    };
  }
  async function restart() {
    if (server !== undefined) await shutdown(server);
    server = undefined;
    return start();
  }
  const created = await createTournament(dependencies, { name: 'recovery', maxParticipants: 10 });
  if (!created.ok) throw new Error('create failed');
  return {
    dependencies,
    snapshots,
    start,
    restart,
    tournamentId: created.response.tournament.id,
    hostToken: created.response.hostToken,
  };
}
it('recovers scores, pending answers and finished results, then permanently closes the room', async () => {
  const test = await setup();
  let open = await test.start();
  let host = await open();
  let state = nextRoomState(host);
  await emitHostJoin(host, test);
  await state;
  let player = await open();
  let views = Promise.all([nextRoomState(host), nextRoomState(player)]);
  const joined = await emitParticipantJoin(player, {
    tournamentId: test.tournamentId,
    displayName: '太郎',
  });
  if (!joined.ok) throw new Error('join failed');
  await views;
  const both = () => Promise.all([nextRoomState(host), nextRoomState(player)]);
  views = both();
  player.emit('game:buzz', {});
  await views;
  views = both();
  host.emit('judge:submit', {
    participantId: joined.participantId,
    isCorrect: true,
    scoreDelta: 3,
    nextAction: 'resetToIdle',
  });
  await views;
  views = both();
  player.emit('game:buzz', {});
  await views;
  views = both();
  player.emit('answer:submit', { answerText: '未判定の回答' });
  await views;
  open = await test.restart();
  player = await open();
  state = nextRoomState(player);
  expect(
    await emitParticipantJoin(player, {
      tournamentId: test.tournamentId,
      displayName: '太郎',
      participantId: joined.participantId,
    }),
  ).toMatchObject({ ok: true, isReconnect: true, participantId: joined.participantId });
  const paused = await state;
  expect(paused).toMatchObject({
    status: 'paused',
    statusBeforePause: 'answering',
    hostOnline: false,
    currentResponderId: joined.participantId,
  });
  expect(paused).not.toHaveProperty('currentSubmittedAnswer');
  expect(paused.participants.find((p) => p.id === joined.participantId)?.score).toBe(3);
  host = await open();
  views = both();
  await emitHostJoin(host, test);
  const [restored] = await views;
  expect(restored).toMatchObject({
    status: 'answering',
    currentSubmittedAnswer: { answerText: '未判定の回答' },
  });
  views = both();
  host.emit('judge:submit', {
    participantId: joined.participantId,
    isCorrect: false,
    scoreDelta: 0,
    nextAction: 'showResult',
  });
  await views;
  views = both();
  host.emit('tournament:finish', {});
  await views;
  await vi.waitFor(async () =>
    expect((await test.dependencies.repository.findById(test.tournamentId))?.status).toBe('closed'),
  );
  expect((await test.snapshots.find(test.tournamentId))?.status).toBe('finished');
  open = await test.restart();
  player = await open();
  state = nextRoomState(player);
  expect(
    await emitParticipantJoin(player, {
      tournamentId: test.tournamentId,
      displayName: '太郎',
      participantId: joined.participantId,
    }),
  ).toMatchObject({ ok: true });
  expect((await state).status).toBe('finished');
  const newcomer = await open();
  expect(
    await emitParticipantJoin(newcomer, { tournamentId: test.tournamentId, displayName: '新規' }),
  ).toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
  host = await open();
  views = both();
  await emitHostJoin(host, test);
  await views;
  // A failed delete leaves the visible result connected and permits a later retry.
  const remove = vi
    .spyOn(test.snapshots, 'remove')
    .mockRejectedValueOnce(new Error('storage unavailable'));
  const error = nextError(host);
  host.emit('room:close', {});
  expect(await error).toMatchObject({ code: 'INTERNAL_ERROR' });
  expect(player.connected).toBe(true);
  const disconnected = Promise.all([
    new Promise<void>((r) => host.once('disconnect', () => r())),
    new Promise<void>((r) => player.once('disconnect', () => r())),
  ]);
  host.emit('room:close', {});
  await disconnected;
  expect(remove).toHaveBeenCalledTimes(2);
  expect(await test.snapshots.find(test.tournamentId)).toBeUndefined();
  open = await test.restart();
  const afterClose = await open();
  expect(await emitHostJoin(afterClose, test)).toMatchObject({
    ok: false,
    code: 'TOURNAMENT_NOT_JOINABLE',
  });
  expect(
    await emitParticipantJoin(afterClose, {
      tournamentId: test.tournamentId,
      displayName: '太郎',
      participantId: joined.participantId,
    }),
  ).toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
});
