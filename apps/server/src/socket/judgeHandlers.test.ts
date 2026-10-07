/** Real sockets verify immediate verdict delivery, server scoring, privacy and host-only rules. */
import { afterEach, describe, expect, it } from 'vitest';
import {
  SEVEN_MARU_THREE_BATSU,
  type GameRules,
  type JudgeSubmitPayload,
  type EffectPlayPayload,
  type JudgementEffectEvent,
  type ScoreAdjustPayload,
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
function effects(room: SeededRoom) {
  return Promise.all(
    [room.host, room.first, room.second].map(
      (client) =>
        new Promise<JudgementEffectEvent>((resolve) => client.once('effect:judgement', resolve)),
    ),
  );
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
  it('shows the match result to everyone, then starts the next match from zero', async () => {
    const room = await (await start()).seedRoom('連戦');
    await setRules(room, SEVEN_MARU_THREE_BATSU);
    await judge(room, await buzz(room), true);
    const finished = everywhere(room);
    room.host.emit('match:finish', {});
    for (const state of await finished) {
      expect(state.status).toBe('matchResult');
      expect(state.lastResult).toBeUndefined();
      expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
        score: 1,
        correctCount: 1,
      });
    }
    const blocked = nextError(room.first);
    const resync = everywhere(room);
    room.first.emit('game:buzz', {});
    expect((await blocked).code).toBe('INVALID_STATE');
    await resync;
    const started = everywhere(room);
    room.host.emit('match:next', {});
    for (const state of await started) {
      expect(state.status).toBe('idle');
      expect(state.rules).toEqual(SEVEN_MARU_THREE_BATSU);
      for (const seat of state.participants)
        expect(seat).toMatchObject({ score: 0, correctCount: 0, wrongCount: 0 });
    }
    // A new match is a new chance to choose rules, and the buzzer is live again.
    await setRules(room, { type: 'points', correctPoints: 3, wrongPoints: 0 });
    const views = await judge(room, await buzz(room), true);
    expect(views[0]?.participants.find((p) => p.id === room.firstId)?.score).toBe(3);
  });
  it.each([true, false])(
    'cues everyone once when a verdict is accepted, correct=%s',
    async (isCorrect) => {
      const room = await (await start()).seedRoom('判定演出');
      const id = await buzz(room);
      const cued = effects(room);
      await judge(room, id, isCorrect);
      expect(await cued).toEqual([{ isCorrect }, { isCorrect }, { isCorrect }]);
      // A refused repeat of the same verdict must stay silent.
      let extra = 0;
      for (const client of [room.host, room.first, room.second])
        client.on('effect:judgement', () => (extra += 1));
      const refused = nextError(room.host);
      const resync = everywhere(room);
      room.host.emit('judge:submit', { participantId: room.firstId, buzzSessionId: id, isCorrect });
      expect((await refused).code).toBe('INVALID_STATE');
      await resync;
      expect(extra).toBe(0);
    },
  );
  it('lets the host cue everyone without a verdict, moving no score, but never mid-answer', async () => {
    const room = await (await start()).seedRoom('演出のみ');
    for (const isCorrect of [true, false]) {
      const cued = effects(room);
      room.host.emit('effect:play', { isCorrect });
      expect(await cued).toEqual([{ isCorrect }, { isCorrect }, { isCorrect }]);
    }
    const id = await buzz(room);
    let cues = 0;
    room.first.on('effect:judgement', () => (cues += 1));
    const refused = nextError(room.host);
    const resync = everywhere(room);
    room.host.emit('effect:play', { isCorrect: true });
    expect((await refused).code).toBe('INVALID_STATE');
    for (const state of await resync) {
      expect(state.status).toBe('answering');
      for (const seat of state.participants) expect(seat.score).toBe(0);
    }
    expect(cues).toBe(0);
    // After the verdict the buttons are a flourish again.
    const judged = effects(room);
    await judge(room, id, true);
    await judged;
    const again = effects(room);
    room.host.emit('effect:play', { isCorrect: false });
    await again;
    expect(cues).toBe(2);
    const malformed = nextError(room.host);
    room.host.emit('effect:play', { isCorrect: 'true' } as unknown as EffectPlayPayload);
    expect((await malformed).code).toBe('VALIDATION_ERROR');
  });
  it('lets the host undo a mistaken verdict, and refuses corrections mid-answer or malformed', async () => {
    const room = await (await start()).seedRoom('得点修正');
    await setRules(room, SEVEN_MARU_THREE_BATSU);
    // Pressed the wrong button: the seat is now one miss down that it should not be.
    await judge(room, await buzz(room), false);
    const corrected = everywhere(room);
    room.host.emit('score:adjust', {
      participantId: room.firstId,
      adjustment: { type: 'maruBatsu', correctCount: 1, wrongCount: 0 },
    });
    for (const state of await corrected) {
      expect(state.status).toBe('result');
      expect(state.participants.find((p) => p.id === room.firstId)).toMatchObject({
        score: 1,
        correctCount: 1,
        wrongCount: 0,
      });
    }
    await reset(room);
    await buzz(room);
    const refused = nextError(room.host);
    const resync = everywhere(room);
    room.host.emit('score:adjust', {
      participantId: room.firstId,
      adjustment: { type: 'maruBatsu', correctCount: 7, wrongCount: 0 },
    });
    expect((await refused).code).toBe('INVALID_STATE');
    expect((await resync)[0]?.participants.find((p) => p.id === room.firstId)?.correctCount).toBe(
      1,
    );
    for (const payload of [
      { participantId: '', adjustment: { type: 'maruBatsu', correctCount: 1, wrongCount: 0 } },
      { participantId: room.firstId, adjustment: { type: 'maruBatsu', correctCount: -1 } },
      { participantId: room.firstId, adjustment: { type: 'points', score: '5' } },
      { participantId: room.firstId },
    ]) {
      const error = nextError(room.host);
      room.host.emit('score:adjust', payload as unknown as ScoreAdjustPayload);
      expect((await error).code).toBe('VALIDATION_ERROR');
    }
  });
  it('requires a session and current host authority for every host operation', async () => {
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
        () =>
          client.emit('score:adjust', {
            participantId: room.secondId,
            adjustment: { type: 'points', score: 100 },
          }),
        () => client.emit('effect:play', { isCorrect: true }),
        () => client.emit('match:finish', {}),
        () => client.emit('match:next', {}),
      ];
      for (const send of operations) {
        const error = nextError(client);
        send();
        expect((await error).code).toBe(code);
      }
    }
  });
});
