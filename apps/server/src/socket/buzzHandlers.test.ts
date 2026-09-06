/**
 * Integration tests for `game:buzz` over a real Socket.io server.
 *
 * These pin the contract the play screen depends on: presses from two joined clients land in
 * the same order on every connection, a refused press gets an `error` without inventing a
 * new order, and the actor is never taken from the payload.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  nextError,
  nextRoomState,
  startSocketTestHarness,
  type SocketTestHarness,
} from '../testing/socketTestHarness';
import { TEST_NOW } from '../testing/appDependencies';

let harness: SocketTestHarness | undefined;

async function start(): Promise<SocketTestHarness> {
  harness = await startSocketTestHarness();
  return harness;
}

afterEach(async () => {
  await harness?.stop();
  harness = undefined;
});

describe('buzz handlers', () => {
  it('records two presses in receive order and syncs that order to every client', async () => {
    const { seedRoom } = await start();
    const { host, first, second, firstId, secondId } = await seedRoom('早押し同期大会');

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
    const { seedRoom } = await start();
    const { first, second } = await seedRoom('二重押し大会');

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
    const { seedRoom } = await start();
    const { host } = await seedRoom('ホスト押下大会');

    const errorPromise = nextError(host);
    const resyncPromise = nextRoomState(host);
    host.emit('game:buzz', {});
    const [error, resync] = await Promise.all([errorPromise, resyncPromise]);

    expect(error.code).toBe('INVALID_STATE');
    expect(resync.status).toBe('idle');
    expect(resync.buzzOrder).toEqual([]);
  });

  it('rejects a buzz before join without inventing a room', async () => {
    const { openClient } = await start();
    const stranger = await openClient();

    const errorPromise = nextError(stranger);
    stranger.emit('game:buzz', {});
    await expect(errorPromise).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });
});
