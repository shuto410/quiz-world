/** Exercises connection replacement and reconnect identity over real Socket.io transports. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  emitParticipantJoin,
  emitHostJoin,
  nextError,
  nextRoomState,
  startSocketTestHarness,
  type SocketTestHarness,
} from '../testing/socketTestHarness';

let harness: SocketTestHarness | undefined;
afterEach(async () => {
  await harness?.stop();
});

it('invalidates every operation on the old socket and ignores its late disconnect', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('多重接続');
  const newer = await harness.openClient();
  const invalidated = new Promise<void>((resolve) =>
    room.first.once('session:invalidated', () => resolve()),
  );
  const joined = nextRoomState(newer);
  await emitParticipantJoin(newer, {
    tournamentId: room.tournamentId,
    displayName: '太郎',
    participantId: room.firstId,
  });
  await joined;
  await invalidated;
  for (const event of [
    'game:buzz',
    'answer:submit',
    'judge:submit',
    'game:reset',
    'tournament:finish',
    'room:close',
    'tournament:leave',
  ] as const) {
    const error = nextError(room.first);
    if (event === 'answer:submit') room.first.emit(event, { answerText: '回答' });
    else if (event === 'judge:submit')
      room.first.emit(event, {
        participantId: room.firstId,
        isCorrect: true,
        scoreDelta: 1,
        nextAction: 'showResult',
      });
    else room.first.emit(event, {});
    await expect(error).resolves.toMatchObject({ code: 'STALE_CONNECTION' });
  }
  await expect(
    emitParticipantJoin(room.first, {
      tournamentId: room.tournamentId,
      displayName: '太郎',
      participantId: room.firstId,
    }),
  ).resolves.toMatchObject({ ok: false, code: 'STALE_CONNECTION' });
  room.first.disconnect();
  const buzzed = nextRoomState(newer);
  newer.emit('game:buzz', {});
  const state = await buzzed;
  expect(state.currentResponderId).toBe(room.firstId);
  expect(state.participants.find((p) => p.id === room.firstId)?.online).toBe(true);
});

it('marks a disconnected seat offline and restores its score, including after finish', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('復帰');
  let state = nextRoomState(room.host);
  room.first.emit('game:buzz', {});
  await state;
  state = nextRoomState(room.host);
  room.host.emit('judge:submit', {
    participantId: room.firstId,
    isCorrect: true,
    scoreDelta: 5,
    nextAction: 'showResult',
  });
  await state;
  state = nextRoomState(room.host);
  room.first.disconnect();
  expect((await state).participants.find((p) => p.id === room.firstId)).toMatchObject({
    online: false,
    name: '太郎',
    score: 5,
  });
  state = nextRoomState(room.host);
  room.host.emit('tournament:finish', {});
  await state;
  const newer = await harness.openClient();
  const restored = nextRoomState(newer);
  await expect(
    emitParticipantJoin(newer, {
      tournamentId: room.tournamentId,
      displayName: '太郎',
      participantId: room.firstId,
    }),
  ).resolves.toMatchObject({ ok: true, isReconnect: true, participantId: room.firstId });
  expect((await restored).participants.find((p) => p.id === room.firstId)).toMatchObject({
    online: true,
    name: '太郎',
    score: 5,
  });
});

it('does not leave a ghost seat when a connection drops during the database read', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('接続待ち中の切断');
  const newcomer = await harness.openClient();
  const record = await harness.dependencies.repository.findById(room.tournamentId);
  const pending = deferred<typeof record>();
  const started = deferred<void>();
  vi.spyOn(harness.dependencies.repository, 'findById').mockImplementationOnce(() => {
    started.resolve(undefined);
    return pending.promise;
  });
  newcomer.emit(
    'tournament:join',
    { tournamentId: room.tournamentId, displayName: '消えた参加者' },
    () => {},
  );
  await started.promise;
  await expect(
    emitParticipantJoin(newcomer, { tournamentId: room.tournamentId, displayName: '二重参加' }),
  ).resolves.toMatchObject({ ok: false, code: 'INVALID_STATE' });
  newcomer.disconnect();
  const barrierState = nextRoomState(room.host);
  const barrier = nextError(room.first);
  room.first.emit('room:close', {});
  await Promise.all([barrier, barrierState]);
  pending.resolve(record);
  const newer = await harness.openClient();
  const state = nextRoomState(newer);
  await emitParticipantJoin(newer, {
    tournamentId: room.tournamentId,
    displayName: '本当の参加者',
  });
  expect((await state).participants.map((p) => p.name)).toEqual([
    'ホスト',
    '太郎',
    '花子',
    '本当の参加者',
  ]);
});

it.each(['host', 'participant'] as const)(
  'rejects a %s join that finishes reading after the room has closed',
  async (role) => {
    harness = await startSocketTestHarness();
    const room = await harness.seedRoom('クローズとの競合');
    const newer = await harness.openClient();
    const record = await harness.dependencies.repository.findById(room.tournamentId);
    const pending = deferred<typeof record>();
    const started = deferred<void>();
    vi.spyOn(harness.dependencies.repository, 'findById').mockImplementationOnce(() => {
      started.resolve(undefined);
      return pending.promise;
    });
    const joining =
      role === 'host'
        ? emitHostJoin(newer, { tournamentId: room.tournamentId, hostToken: room.hostToken })
        : emitParticipantJoin(newer, { tournamentId: room.tournamentId, displayName: '遅い接続' });
    await started.promise;
    const finished = nextRoomState(room.host);
    room.host.emit('tournament:finish', {});
    await finished;
    const closed = new Promise<void>((resolve) => room.host.once('disconnect', () => resolve()));
    room.host.emit('room:close', {});
    await closed;
    pending.resolve(record);
    await expect(joining).resolves.toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
    await expect(
      emitParticipantJoin(newer, {
        tournamentId: room.tournamentId,
        displayName: '太郎',
        participantId: room.firstId,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
    await expect(
      emitHostJoin(newer, { tournamentId: room.tournamentId, hostToken: room.hostToken }),
    ).resolves.toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
  },
);

/** Lets a test hold repository I/O while real socket events continue running. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('keeps the current host when another host disconnects during authentication', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('ホスト認証中の切断');
  const newer = await harness.openClient();
  const record = await harness.dependencies.repository.findById(room.tournamentId);
  const pending = deferred<typeof record>();
  const started = deferred<void>();
  vi.spyOn(harness.dependencies.repository, 'findById').mockImplementationOnce(() => {
    started.resolve(undefined);
    return pending.promise;
  });
  void emitHostJoin(newer, { tournamentId: room.tournamentId, hostToken: room.hostToken });
  await started.promise;
  await expect(
    emitHostJoin(newer, { tournamentId: room.tournamentId, hostToken: room.hostToken }),
  ).resolves.toMatchObject({ ok: false, code: 'INVALID_STATE' });
  newer.disconnect();
  const barrierState = nextRoomState(room.host);
  const barrier = nextError(room.first);
  room.first.emit('room:close', {});
  await Promise.all([barrier, barrierState]);
  pending.resolve(record);
  const state = nextRoomState(room.host);
  room.host.emit('tournament:finish', {});
  expect((await state).status).toBe('finished');
});

it('restores the same seat after Socket.io automatically reconnects a dropped transport', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('一時的な通信切断');
  const offline = nextRoomState(room.host);
  const rejoined = new Promise<void>((resolve, reject) => {
    room.first.once('connect', () => {
      const restored = nextRoomState(room.first);
      void emitParticipantJoin(room.first, {
        tournamentId: room.tournamentId,
        displayName: '太郎',
        participantId: room.firstId,
      })
        .then(async (response) => {
          expect(response).toMatchObject({
            ok: true,
            participantId: room.firstId,
            isReconnect: true,
          });
          const state = await restored;
          expect(state.participants).toHaveLength(3);
          expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
            online: true,
            name: '太郎',
          });
          resolve();
        })
        .catch(reject);
    });
  });
  room.first.io.engine.close();
  expect((await offline).participants.find((p) => p.id === room.firstId)?.online).toBe(false);
  await rejoined;
});
