/**
 * Integration tests for `tournament:finish` and `room:close`.
 *
 * Two things here only show up end to end. First, ending the tournament has a side effect
 * outside the room: the stored tournament must come back closed, or the invite code would go
 * on admitting people after the game. Second, closing the room has to actually disconnect the
 * clients, which no unit test of the transition can demonstrate.
 *
 * Scores are asserted on the final broadcast too, because the standings on the result screen
 * are the last thing anyone sees and nothing later can correct them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nextError,
  nextRoomState,
  startSocketTestHarness,
  type AppClient,
  type SeededRoom,
  type SocketTestHarness,
} from '../testing/socketTestHarness';

let harness: SocketTestHarness | undefined;

async function start(): Promise<SocketTestHarness> {
  harness = await startSocketTestHarness();
  return harness;
}

afterEach(async () => {
  await harness?.stop();
  harness = undefined;
});

function nextRoomStateEverywhere(room: SeededRoom) {
  return Promise.all([
    nextRoomState(room.host),
    nextRoomState(room.first),
    nextRoomState(room.second),
  ]);
}

function nextDisconnect(client: AppClient): Promise<string> {
  return new Promise((resolve) => {
    client.once('disconnect', resolve);
  });
}

/** Plays one question: the first participant buzzes, answers and is judged correct. */
async function playOneQuestion(room: SeededRoom): Promise<void> {
  const buzzed = nextRoomStateEverywhere(room);
  room.first.emit('game:buzz', {});
  await buzzed;

  const answered = nextRoomStateEverywhere(room);
  room.first.emit('answer:submit', { answerText: '東京' });
  await answered;

  const judged = nextRoomStateEverywhere(room);
  room.host.emit('judge:submit', {
    participantId: room.firstId,
    isCorrect: true,
    scoreDelta: 1,
    nextAction: 'showResult',
  });
  await judged;
}

describe('finish handlers', () => {
  it('ends the tournament for everyone and closes it in storage', async () => {
    const { seedRoom, dependencies } = await start();
    const room = await seedRoom('終了大会');
    await playOneQuestion(room);

    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    const views = await finished;

    for (const state of views) {
      expect(state.status).toBe('finished');
      // Standings survive; the round that produced them does not.
      expect(state.participants.find((p) => p.id === room.firstId)?.score).toBe(1);
      expect(state.lastResult).toBeUndefined();
      expect(state.currentSubmittedAnswer).toBeUndefined();
    }

    const stored = dependencies.repository.stored()[0];
    expect(stored?.status).toBe('closed');
  });

  it('keeps everyone connected after the tournament ends', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('終了後接続大会');

    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    await finished;

    expect(room.host.connected).toBe(true);
    expect(room.first.connected).toBe(true);
    expect(room.second.connected).toBe(true);
  });

  it('refuses to end a tournament while somebody holds the answer right', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('回答中終了大会');

    const buzzed = nextRoomStateEverywhere(room);
    room.first.emit('game:buzz', {});
    await buzzed;

    const errorPromise = nextError(room.host);
    const resync = nextRoomState(room.host);
    room.host.emit('tournament:finish', {});
    const [error, state] = await Promise.all([errorPromise, resync]);

    expect(error).toEqual({ code: 'INVALID_STATE', message: '現在の状態ではその操作はできません' });
    expect(state.status).toBe('answering');
  });

  it('refuses a participant ending the tournament', async () => {
    const { seedRoom, dependencies } = await start();
    const room = await seedRoom('参加者終了大会');

    const errorPromise = nextError(room.first);
    const resync = nextRoomState(room.first);
    room.first.emit('tournament:finish', {});
    const [error, state] = await Promise.all([errorPromise, resync]);

    expect(error).toEqual({ code: 'NOT_HOST', message: 'ホストのみが実行できる操作です' });
    expect(state.status).toBe('idle');
    expect(dependencies.repository.stored()[0]?.status).toBe('active');
  });

  it('turns away a newcomer once the tournament has finished', async () => {
    const { seedRoom, openClient } = await start();
    const room = await seedRoom('終了後参加大会');

    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    await finished;

    const latecomer = await openClient();
    const ack = await new Promise((resolve) => {
      latecomer.emit(
        'tournament:join',
        { tournamentId: room.tournamentId, displayName: '遅刻' },
        resolve,
      );
    });

    expect(ack).toMatchObject({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE' });
  });

  it('tells everyone the room closed and disconnects them', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('クローズ大会');

    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    await finished;

    const closedEvents = Promise.all(
      [room.host, room.first, room.second].map(
        (client) =>
          new Promise((resolve) => {
            client.once('room:closed', resolve);
          }),
      ),
    );
    const disconnects = Promise.all(
      [room.host, room.first, room.second].map((client) => nextDisconnect(client)),
    );

    room.host.emit('room:close', {});

    for (const event of await closedEvents) {
      expect(event).toEqual({ reason: 'hostClosed' });
    }
    await disconnects;
    expect(room.first.connected).toBe(false);
  });

  it('refuses to close a room that is still playing, and to close it as a participant', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('クローズ権限大会');

    const hostError = nextError(room.host);
    room.host.emit('room:close', {});
    await expect(hostError).resolves.toMatchObject({ code: 'INVALID_STATE' });

    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    await finished;

    const participantError = nextError(room.first);
    room.first.emit('room:close', {});
    await expect(participantError).resolves.toMatchObject({ code: 'NOT_HOST' });
    expect(room.first.connected).toBe(true);
  });

  it('keeps the finished room usable when closing storage fails and retries on close', async () => {
    const { seedRoom, dependencies } = await start();
    const room = await seedRoom('DB障害大会');
    const update = vi.spyOn(dependencies.repository, 'updateStatus');
    update.mockRejectedValueOnce(new Error('finish write failed'));
    const finished = nextRoomStateEverywhere(room);
    room.host.emit('tournament:finish', {});
    await finished;
    update.mockRejectedValueOnce(new Error('close write failed'));
    const error = nextError(room.host);
    room.host.emit('room:close', {});
    await expect(error).resolves.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(room.host.connected).toBe(true);
    expect(room.first.connected).toBe(true);
    expect(dependencies.repository.stored()[0]?.status).toBe('active');
    const disconnected = nextDisconnect(room.first);
    room.host.emit('room:close', {});
    await disconnected;
    expect(update).toHaveBeenCalledTimes(3);
    expect(dependencies.repository.stored()[0]?.status).toBe('closed');
  });

  it('refuses both operations from a connection that never joined', async () => {
    const { openClient } = await start();
    const stranger = await openClient();

    const finishError = nextError(stranger);
    stranger.emit('tournament:finish', {});
    await expect(finishError).resolves.toMatchObject({ code: 'INVALID_STATE' });

    const closeError = nextError(stranger);
    stranger.emit('room:close', {});
    await expect(closeError).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });
});
