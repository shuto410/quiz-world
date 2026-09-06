/**
 * Integration tests for `judge:submit` and `game:reset` over a real Socket.io server.
 *
 * The judgement is where the audience split flips: before it, only the host may read the
 * answer; on the result screen everyone may. Both directions of that flip are checked on the
 * wire, because a handler that emitted state itself would pass a unit test and still leak.
 *
 * The rest guards the property that makes judging different from every other operation: a
 * score can only ever be added to. Refusals — wrong sender, empty queue, malformed score —
 * must leave the standings exactly as they were.
 */

import type { JudgeSubmitPayload } from '@quiz-world/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TEST_NOW } from '../testing/appDependencies';
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

/**
 * Waits for the broadcast every connection receives from one accepted change.
 *
 * All three have to be consumed, even when a test only asserts on one of them: an
 * unclaimed broadcast would be picked up by the next listener and shift that test's
 * assertions onto the previous state.
 */
function nextRoomStateEverywhere(room: SeededRoom) {
  return Promise.all([
    nextRoomState(room.host),
    nextRoomState(room.first),
    nextRoomState(room.second),
  ]);
}

/** Lets the given participants buzz in order, waiting for each broadcast to land. */
async function buzzIn(room: SeededRoom, clients: AppClient[]): Promise<void> {
  for (const client of clients) {
    const seen = nextRoomStateEverywhere(room);
    client.emit('game:buzz', {});
    await seen;
  }
}

/** Buzzes with the first participant and has them submit an answer. */
async function openRoundWithAnswer(room: SeededRoom): Promise<void> {
  await buzzIn(room, [room.first]);
  const seen = nextRoomStateEverywhere(room);
  room.first.emit('answer:submit', { answerText: '東京' });
  await seen;
}

function scoreOf(
  state: { participants: readonly { id: string; score: number }[] },
  participantId: string,
): number | undefined {
  return state.participants.find((participant) => participant.id === participantId)?.score;
}

describe('judge handlers', () => {
  it('scores the responder and reveals the answer to everyone on the result screen', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('判定大会');
    await openRoundWithAnswer(room);

    const hostView = nextRoomState(room.host);
    const responderView = nextRoomState(room.first);
    const bystanderView = nextRoomState(room.second);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: true,
      scoreDelta: 2,
      nextAction: 'showResult',
    });
    const views = await Promise.all([hostView, responderView, bystanderView]);

    for (const state of views) {
      expect(state.status).toBe('result');
      expect(scoreOf(state, room.firstId)).toBe(2);
      expect(state.lastResult).toEqual({
        participantId: room.firstId,
        isCorrect: true,
        scoreDelta: 2,
      });
      // The judgement is what lets participants read the answer at last.
      expect(state.currentSubmittedAnswer).toEqual({
        participantId: room.firstId,
        answerText: '東京',
        receivedAt: TEST_NOW,
      });
      expect(state.buzzOrder).toEqual([]);
    }
  });

  it('passes the answer right to the next buzzer and hides the answer again', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('次の回答者大会');
    await buzzIn(room, [room.first, room.second]);
    const answered = nextRoomStateEverywhere(room);
    room.first.emit('answer:submit', { answerText: '大阪' });
    await answered;

    const hostView = nextRoomState(room.host);
    const bystanderView = nextRoomState(room.second);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: false,
      scoreDelta: -1,
      nextAction: 'moveToNextResponder',
    });
    const [forHost, forBystander] = await Promise.all([hostView, bystanderView]);

    expect(forHost.status).toBe('answering');
    expect(forHost.currentResponderId).toBe(room.secondId);
    expect(scoreOf(forHost, room.firstId)).toBe(-1);
    // The wrong answer is cleared for the host too: it belonged to the previous responder.
    expect(forHost.currentSubmittedAnswer).toBeUndefined();
    expect(forBystander).not.toHaveProperty('currentSubmittedAnswer');
  });

  it('refuses to move on when nobody else buzzed, without banking the points', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('次候補なし大会');
    await buzzIn(room, [room.first]);

    const errorPromise = nextError(room.host);
    const resync = nextRoomState(room.host);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: false,
      scoreDelta: -1,
      nextAction: 'moveToNextResponder',
    });
    const [error, state] = await Promise.all([errorPromise, resync]);

    expect(error).toEqual({ code: 'NO_NEXT_RESPONDER', message: '次の回答者がいません' });
    expect(state.status).toBe('answering');
    expect(scoreOf(state, room.firstId)).toBe(0);
  });

  it('refuses a judgement sent by a participant', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('参加者判定大会');
    await buzzIn(room, [room.first]);

    const errorPromise = nextError(room.second);
    const hostView = nextRoomState(room.host);
    room.second.emit('judge:submit', {
      participantId: room.secondId,
      isCorrect: true,
      scoreDelta: 99,
      nextAction: 'showResult',
    });
    const [error, state] = await Promise.all([errorPromise, hostView]);

    expect(error).toEqual({ code: 'NOT_HOST', message: 'ホストのみが実行できる操作です' });
    expect(scoreOf(state, room.secondId)).toBe(0);
    expect(state.status).toBe('answering');
  });

  it('refuses a score that is not a whole number in range', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('不正な得点大会');
    await buzzIn(room, [room.first]);

    const errorPromise = nextError(room.host);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: true,
      scoreDelta: 1.5,
      nextAction: 'showResult',
    });

    await expect(errorPromise).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: '得点は-999〜999の整数で入力してください',
    });
  });

  it('refuses a follow-up action it does not recognise', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('未知アクション大会');
    await buzzIn(room, [room.first]);

    const errorPromise = nextError(room.host);
    // A client built against a different version of the contract, or a hand-crafted payload.
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'finishTournament',
    } as unknown as JudgeSubmitPayload);

    await expect(errorPromise).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください',
    });
  });

  it('refuses a judgement aimed at somebody who does not hold the answer right', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('対象違い大会');
    await buzzIn(room, [room.first, room.second]);

    const errorPromise = nextError(room.host);
    const resync = nextRoomState(room.host);
    room.host.emit('judge:submit', {
      participantId: room.secondId,
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'showResult',
    });
    const [error, state] = await Promise.all([errorPromise, resync]);

    expect(error.code).toBe('INVALID_STATE');
    expect(scoreOf(state, room.secondId)).toBe(0);
    expect(state.currentResponderId).toBe(room.firstId);
  });

  it('reopens buzzing on game:reset and takes the answer back off the participants view', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('リセット大会');
    await openRoundWithAnswer(room);

    const judged = nextRoomStateEverywhere(room);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'showResult',
    });
    await judged;

    const hostView = nextRoomState(room.host);
    const bystanderView = nextRoomState(room.second);
    room.host.emit('game:reset', {});
    const [forHost, forBystander] = await Promise.all([hostView, bystanderView]);

    for (const state of [forHost, forBystander]) {
      expect(state.status).toBe('idle');
      expect(state.lastResult).toBeUndefined();
      expect(state.currentSubmittedAnswer).toBeUndefined();
      // The points awarded a moment ago stay: a reset is not an undo.
      expect(scoreOf(state, room.firstId)).toBe(1);
    }
  });

  it('refuses game:reset from a participant and while no result is on screen', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('リセット権限大会');

    const participantError = nextError(room.first);
    room.first.emit('game:reset', {});
    await expect(participantError).resolves.toMatchObject({ code: 'NOT_HOST' });

    const hostError = nextError(room.host);
    room.host.emit('game:reset', {});
    await expect(hostError).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('refuses both operations from a connection that never joined', async () => {
    const { openClient } = await start();
    const stranger = await openClient();

    const judgeError = nextError(stranger);
    stranger.emit('judge:submit', {
      participantId: 'participant-1',
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'showResult',
    });
    await expect(judgeError).resolves.toMatchObject({ code: 'INVALID_STATE' });

    const resetError = nextError(stranger);
    stranger.emit('game:reset', {});
    await expect(resetError).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });
});
