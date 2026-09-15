/** Judgement is immediate, server-scored and distinct from subsequent progression. */
import { describe, expect, it } from 'vitest';
import { GAME_STATUSES, SEVEN_MARU_THREE_BATSU, type InternalRoomState } from '@quiz-world/shared';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyJudge, applyGameReset, applyNextResponder } from './judge';
import { applyBuzz } from './buzz';
import { applyRulesUpdate } from './rules';

function room(overrides: Partial<InternalRoomState> = {}): InternalRoomState {
  return createRoomStateFixture({
    status: 'answering',
    hostId: 'h',
    participants: [
      {
        id: 'h',
        name: 'Host',
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        online: true,
        joinedAt: 0,
      },
      { id: 'a', name: 'A', score: 0, correctCount: 0, wrongCount: 0, online: true, joinedAt: 1 },
      { id: 'b', name: 'B', score: 0, correctCount: 0, wrongCount: 0, online: false, joinedAt: 2 },
    ],
    currentBuzzSession: { id: 'round', startedAt: 1 },
    buzzOrder: [
      { participantId: 'a', receivedAt: 1 },
      { participantId: 'b', receivedAt: 2 },
    ],
    currentResponderId: 'a',
    currentSubmittedAnswer: { participantId: 'a', answerText: '東京', receivedAt: 3 },
    ...overrides,
  });
}
const input = {
  actorId: 'h',
  targetParticipantId: 'a',
  buzzSessionId: 'round',
  isCorrect: true,
  now: 4,
};
function accepted(result: ReturnType<typeof applyJudge>): InternalRoomState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

describe('applyJudge', () => {
  it.each(GAME_STATUSES)('accepts only answering, tested in %s', (status) => {
    expect(applyJudge(room({ status }), input).ok).toBe(status === 'answering');
  });
  it.each(['a', 'b', 'stranger'])('rejects non-host %s', (actorId) => {
    expect(applyJudge(room(), { ...input, actorId })).toEqual({ ok: false, code: 'NOT_HOST' });
  });
  it.each([
    { targetParticipantId: 'b' },
    { targetParticipantId: 'h' },
    { targetParticipantId: 'absent' },
    { buzzSessionId: 'previous-round' },
  ])('rejects stale or invalid aim %j', (overrides) => {
    const before = room();
    const original = structuredClone(before);
    expect(applyJudge(before, { ...input, ...overrides })).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    });
    expect(before).toEqual(original);
  });
  it.each([
    { isCorrect: true, delta: 2, correct: 1, wrong: 0 },
    { isCorrect: false, delta: -3, correct: 0, wrong: 1 },
  ])('applies configured points and counts once: %j', ({ isCorrect, delta, correct, wrong }) => {
    const current = room({ rules: { type: 'points', correctPoints: 2, wrongPoints: -3 } });
    const before = structuredClone(current);
    const result = accepted(applyJudge(current, { ...input, isCorrect }));
    expect(current).toEqual(before);
    expect(result.status).toBe('result');
    expect(result.participants[1]).toMatchObject({
      score: delta,
      correctCount: correct,
      wrongCount: wrong,
    });
    expect(result.participants[0]).toEqual(current.participants[0]);
    expect(result.participants[2]).toEqual(current.participants[2]);
    expect(result.lastResult).toEqual({ participantId: 'a', isCorrect, scoreDelta: delta });
    expect(result.currentSubmittedAnswer).toEqual(current.currentSubmittedAnswer);
    expect(result.buzzOrder).toEqual(current.buzzOrder);
    expect(applyJudge(result, input)).toEqual({ ok: false, code: 'INVALID_STATE' });
  });
  it('accepts zero points and an oral answer', () => {
    const { currentSubmittedAnswer, ...current } = room({
      rules: { type: 'points', correctPoints: 0, wrongPoints: 0 },
    });
    const result = accepted(applyJudge(current, input));
    expect(result.participants[1]).toMatchObject({ score: 0, correctCount: 1 });
    expect(result.currentSubmittedAnswer).toBeUndefined();
  });
  it.each([true, false])('enforces the 7○3× boundary for correct=%s', (isCorrect) => {
    const current = room({ rules: SEVEN_MARU_THREE_BATSU });
    current.participants = current.participants.map((p) =>
      p.id === 'a' ? { ...p, score: 6, correctCount: 6, wrongCount: 2 } : p,
    );
    const result = accepted(applyJudge(current, { ...input, isCorrect }));
    expect(result.participants[1]).toMatchObject({
      score: isCorrect ? 7 : 6,
      correctCount: isCorrect ? 7 : 6,
      wrongCount: isCorrect ? 2 : 3,
    });
    const idle = accepted(applyGameReset(result, { actorId: 'h', now: 5 }));
    expect(applyBuzz(idle, { participantId: 'a', newBuzzSessionId: 'new', now: 6 })).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    });
    expect(applyBuzz(idle, { participantId: 'b', newBuzzSessionId: 'new', now: 6 }).ok).toBe(true);
  });
});

describe('progression after judgement', () => {
  const wrongResult = () => accepted(applyJudge(room(), { ...input, isCorrect: false }));
  it('passes to the next offline seat, keeps the verdict, and hides the old text', () => {
    const result = wrongResult();
    const next = accepted(applyNextResponder(result, { actorId: 'h', now: 5 }));
    expect(next.status).toBe('answering');
    expect(next.currentResponderId).toBe('b');
    expect(next.currentSubmittedAnswer).toBeUndefined();
    expect(next.lastResult).toEqual(result.lastResult);
    expect(next.participants).toEqual(result.participants);
    expect(next.currentBuzzSession).toEqual(result.currentBuzzSession);
    expect(applyJudge(next, input).ok).toBe(false);
  });
  it('cannot advance from a correct result or when there is no next candidate', () => {
    expect(
      applyNextResponder(accepted(applyJudge(room(), input)), { actorId: 'h', now: 5 }).ok,
    ).toBe(false);
    const current = wrongResult();
    current.buzzOrder = [{ participantId: 'a', receivedAt: 1 }];
    expect(applyNextResponder(current, { actorId: 'h', now: 5 })).toEqual({
      ok: false,
      code: 'NO_NEXT_RESPONDER',
    });
    current.buzzOrder = [];
    expect(applyNextResponder(current, { actorId: 'h', now: 5 }).ok).toBe(false);
  });
  it.each(GAME_STATUSES)('only progresses from result, tested in %s', (status) => {
    const current = { ...wrongResult(), status };
    expect(applyNextResponder(current, { actorId: 'h', now: 5 }).ok).toBe(status === 'result');
    expect(applyGameReset(current, { actorId: 'h', now: 5 }).ok).toBe(status === 'result');
  });
  it('refuses both progression controls from participants', () => {
    for (const transition of [applyNextResponder, applyGameReset]) {
      expect(transition(wrongResult(), { actorId: 'a', now: 5 })).toEqual({
        ok: false,
        code: 'NOT_HOST',
      });
    }
  });
  it('clears round state while preserving points, counts and rules', () => {
    const result = wrongResult();
    const next = accepted(applyGameReset(result, { actorId: 'h', now: 5 }));
    expect(next.status).toBe('idle');
    expect(next.buzzOrder).toEqual([]);
    for (const key of [
      'currentBuzzSession',
      'currentResponderId',
      'currentSubmittedAnswer',
      'lastResult',
    ])
      expect(next).not.toHaveProperty(key);
    expect(next.participants).toEqual(result.participants);
    expect(next.rules).toEqual(result.rules);
  });
});

describe('applyRulesUpdate', () => {
  it.each(GAME_STATUSES)('allows pre-judgement settings only in idle, tested in %s', (status) => {
    const result = applyRulesUpdate(room({ status }), {
      actorId: 'h',
      rules: SEVEN_MARU_THREE_BATSU,
      now: 5,
    });
    expect(result.ok).toBe(status === 'idle');
    if (result.ok) expect(result.state.rules).toEqual(SEVEN_MARU_THREE_BATSU);
  });
  it('requires host authority', () =>
    expect(
      applyRulesUpdate(room({ status: 'idle' }), {
        actorId: 'a',
        rules: SEVEN_MARU_THREE_BATSU,
        now: 5,
      }),
    ).toEqual({ ok: false, code: 'NOT_HOST' }));
  it.each([{ correctCount: 1 }, { wrongCount: 1 }, { score: -1 }])(
    'locks rules after play, including zero-point and legacy rounds %j',
    (counts) => {
      const current = room({ status: 'idle' });
      current.participants = current.participants.map((p) =>
        p.id === 'a' ? { ...p, ...counts } : p,
      );
      expect(
        applyRulesUpdate(current, { actorId: 'h', rules: SEVEN_MARU_THREE_BATSU, now: 5 }),
      ).toEqual({ ok: false, code: 'INVALID_STATE' });
    },
  );
});
