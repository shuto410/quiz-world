/** Real sockets verify immediate verdict delivery, server scoring, privacy and host-only rules. */
import { afterEach, describe, expect, it } from 'vitest';
import {
  SEVEN_MARU_THREE_BATSU,
  type GameRules,
  type JudgeSubmitPayload,
} from '@quiz-world/shared';
import {
  nextError,
  nextRoomState,
  startSocketTestHarness,
  type SocketTestHarness,
  type SeededRoom,
  type AppClient,
} from '../testing/socketTestHarness';
let harness: SocketTestHarness | undefined;
afterEach(async () => {
  await harness?.stop();
});
async function start() {
  harness = await startSocketTestHarness();
  return harness;
}
function everywhere(room: SeededRoom) {
  return Promise.all([room.host, room.first, room.second].map(nextRoomState));
}
async function setRules(room: SeededRoom, rules: GameRules) {
  const seen = everywhere(room);
  room.host.emit('game:rules-update', { rules });
  const views = await seen;
  for (const state of views) expect(state.rules).toEqual(rules);
}
async function buzz(room: SeededRoom, clients: AppClient[] = [room.first]) {
  let sessionId = '';
  for (const client of clients) {
    const seen = everywhere(room);
    client.emit('game:buzz', {});
    const [state] = await seen;
    sessionId = state?.currentBuzzSession?.id ?? '';
  }
  expect(sessionId).not.toBe('');
  return sessionId;
}
async function judge(room: SeededRoom, buzzSessionId: string, isCorrect: boolean) {
  const seen = everywhere(room);
  room.host.emit('judge:submit', { participantId: room.firstId, buzzSessionId, isCorrect });
  return seen;
}
async function reset(room: SeededRoom) {
  const seen = everywhere(room);
  room.host.emit('game:reset', {});
  await seen;
}

describe('judge handlers', () => {
  it('publishes configured points and verdict to everyone immediately, then progresses without rescoring', async () => {
    const room = await (await start()).seedRoom('即時判定');
    await setRules(room, { type: 'points', correctPoints: 2, wrongPoints: -1 });
    const id = await buzz(room, [room.first, room.second]);
    const answered = everywhere(room);
    room.first.emit('answer:submit', { answerText: '東京' });
    const [host, ...players] = await answered;
    expect(host?.currentSubmittedAnswer?.answerText).toBe('東京');
    for (const state of players) expect(state).not.toHaveProperty('currentSubmittedAnswer');
    const views = await judge(room, id, false);
    for (const state of views) {
      expect(state.status).toBe('result');
      expect(state.lastResult).toEqual({
        participantId: room.firstId,
        isCorrect: false,
        scoreDelta: -1,
      });
      expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
        score: -1,
        correctCount: 0,
        wrongCount: 1,
      });
      expect(state.currentSubmittedAnswer?.answerText).toBe('東京');
    }
    const repeated = nextError(room.host);
    const resync = everywhere(room);
    room.host.emit('judge:submit', {
      participantId: room.firstId,
      buzzSessionId: id,
      isCorrect: false,
    });
    expect((await repeated).code).toBe('INVALID_STATE');
    await resync;
    const next = everywhere(room);
    room.host.emit('game:next-responder', {});
    for (const state of await next) {
      expect(state.currentResponderId).toBe(room.secondId);
      expect(state.status).toBe('answering');
      expect(state.lastResult?.isCorrect).toBe(false);
      expect(state).not.toHaveProperty('currentSubmittedAnswer');
      expect(state.participants.find((p) => p.id === room.firstId)?.score).toBe(-1);
    }
    const nextAnswer = everywhere(room);
    room.second.emit('answer:submit', { answerText: '京都' });
    const [, ...participantViews] = await nextAnswer;
    for (const state of participantViews)
      expect(state).not.toHaveProperty('currentSubmittedAnswer');
  });
  it('accepts a correct verdict without submitted text and removes the result on reset', async () => {
    const room = await (await start()).seedRoom('口頭判定');
    await setRules(room, { type: 'points', correctPoints: 2, wrongPoints: 0 });
    const views = await judge(room, await buzz(room), true);
    expect(views[1]?.lastResult?.scoreDelta).toBe(2);
    const next = everywhere(room);
    room.host.emit('game:reset', {});
    for (const state of await next) {
      expect(state.status).toBe('idle');
      expect(state.lastResult).toBeUndefined();
      expect(state.currentBuzzSession).toBeUndefined();
      expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
        score: 2,
        correctCount: 1,
      });
    }
    const locked = nextError(room.host);
    const resync = everywhere(room);
    room.host.emit('game:rules-update', { rules: SEVEN_MARU_THREE_BATSU });
    expect((await locked).code).toBe('INVALID_STATE');
    await resync;
  });
  it.each([true, false])('enforces a full 7○3× match, correct=%s', async (isCorrect) => {
    const room = await (await start()).seedRoom('7○3×');
    await setRules(room, SEVEN_MARU_THREE_BATSU);
    for (let count = 1; count <= (isCorrect ? 7 : 3); count++) {
      const views = await judge(room, await buzz(room), isCorrect);
      for (const state of views)
        expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
          correctCount: isCorrect ? count : 0,
          wrongCount: isCorrect ? 0 : count,
        });
      await reset(room);
    }
    const blocked = nextError(room.first);
    room.first.emit('game:buzz', {});
    expect((await blocked).code).toBe('INVALID_STATE');
  });
  it('refuses stale rounds and wrong targets while leaving the live responder untouched', async () => {
    const room = await (await start()).seedRoom('古い判定');
    const oldId = await buzz(room);
    await judge(room, oldId, true);
    await reset(room);
    const id = await buzz(room);
    for (const payload of [
      { participantId: room.firstId, buzzSessionId: oldId, isCorrect: true },
      { participantId: room.secondId, buzzSessionId: id, isCorrect: true },
    ]) {
      const error = nextError(room.host);
      const seen = everywhere(room);
      room.host.emit('judge:submit', payload);
      expect((await error).code).toBe('INVALID_STATE');
      expect((await seen)[0]?.participants.find((p) => p.id === room.firstId)?.score).toBe(1);
    }
  });
  it('rejects client-supplied points, follow-up actions and malformed verdicts', async () => {
    const room = await (await start()).seedRoom('不正ペイロード');
    const id = await buzz(room);
    for (const extra of [
      { scoreDelta: 999 },
      { nextAction: 'resetToIdle' },
      { isCorrect: 'true' },
      { buzzSessionId: '' },
      { participantId: '' },
    ]) {
      const error = nextError(room.host);
      room.host.emit('judge:submit', {
        participantId: room.firstId,
        buzzSessionId: id,
        isCorrect: true,
        ...extra,
      } as unknown as JudgeSubmitPayload);
      expect((await error).code).toBe('VALIDATION_ERROR');
    }
    const error = nextError(room.host);
    room.host.emit('game:rules-update', {
      rules: { type: 'points', correctPoints: 1.5, wrongPoints: 0 },
    });
    expect((await error).code).toBe('VALIDATION_ERROR');
  });
  it('requires a session and current host authority for all four operations', async () => {
    const test = await start();
    const room = await test.seedRoom('権限');
    const stranger = await test.openClient();
    for (const [client, code] of [
      [room.first, 'NOT_HOST'],
      [stranger, 'INVALID_STATE'],
    ] as const) {
      const operations = [
        () =>
          client.emit('judge:submit', {
            participantId: room.firstId,
            buzzSessionId: 'round',
            isCorrect: true,
          }),
        () => client.emit('game:rules-update', { rules: SEVEN_MARU_THREE_BATSU }),
        () => client.emit('game:next-responder', {}),
        () => client.emit('game:reset', {}),
      ];
      for (const send of operations) {
        const error = nextError(client);
        send();
        expect((await error).code).toBe(code);
      }
    }
  });
});
