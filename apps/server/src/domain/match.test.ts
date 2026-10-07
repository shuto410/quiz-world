/**
 * Tests for ending a match and starting the next one in the same room.
 *
 * Keyed on `GAME_STATUSES`, so a new status has to be classified here before it can exist.
 * The two transitions are checked for opposite things: ending a match may move nobody's
 * score, because the standings on screen must be the ones play produced, while starting the
 * next match must leave nothing of the previous one behind except the seats and the rules.
 */

import {
  GAME_STATUSES,
  SEVEN_MARU_THREE_BATSU,
  type GameStatus,
  type InternalRoomState,
} from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyBuzz } from './buzz';
import { applyMatchFinish, applyMatchNext } from './match';
import { applyRulesUpdate } from './rules';

const host = { actorId: 'h', now: 9 };

function room(overrides: Partial<InternalRoomState> = {}): InternalRoomState {
  return createRoomStateFixture({
    status: 'result',
    hostId: 'h',
    rules: SEVEN_MARU_THREE_BATSU,
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
      { id: 'a', name: 'A', score: 7, correctCount: 7, wrongCount: 1, online: true, joinedAt: 1 },
      { id: 'b', name: 'B', score: 2, correctCount: 2, wrongCount: 3, online: false, joinedAt: 2 },
    ],
    currentBuzzSession: { id: 'round', startedAt: 1 },
    buzzOrder: [{ participantId: 'a', receivedAt: 1 }],
    currentResponderId: 'a',
    currentSubmittedAnswer: { participantId: 'a', answerText: '東京', receivedAt: 2 },
    lastResult: { participantId: 'a', isCorrect: true, scoreDelta: 1 },
    ...overrides,
  });
}

function accepted(result: ReturnType<typeof applyMatchFinish>): InternalRoomState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

/** Whether the host may end the match from each status. */
const FINISH_ACCEPTED: Record<GameStatus, boolean> = {
  idle: true,
  // Somebody holds the answer right; the host judges first.
  answering: false,
  result: true,
  matchResult: false,
  paused: false,
  finished: false,
};

describe('applyMatchFinish', () => {
  it.each(GAME_STATUSES)('is accepted only between questions, tested in %s', (status) => {
    const result = applyMatchFinish(room({ status }), host);
    expect(result.ok).toBe(FINISH_ACCEPTED[status]);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE');
  });

  it.each(['a', 'stranger'])('rejects %s, who is not the host', (actorId) => {
    expect(applyMatchFinish(room(), { actorId, now: 9 })).toEqual({ ok: false, code: 'NOT_HOST' });
  });

  it('shows the standings as played and clears only the round', () => {
    const current = room();
    const before = structuredClone(current);
    const next = accepted(applyMatchFinish(current, host));
    expect(next.status).toBe('matchResult');
    expect(next.participants).toEqual(before.participants);
    expect(next.rules).toEqual(before.rules);
    expect(next.buzzOrder).toEqual([]);
    for (const key of [
      'currentBuzzSession',
      'currentResponderId',
      'currentSubmittedAnswer',
      'lastResult',
    ])
      expect(next).not.toHaveProperty(key);
    expect(next.updatedAt).toBe(9);
    expect(current).toEqual(before);
  });

  it('refuses buzzing while the result is shown', () => {
    const shown = accepted(
      applyMatchFinish(room({ rules: { type: 'points', correctPoints: 1, wrongPoints: 0 } }), host),
    );
    expect(applyBuzz(shown, { participantId: 'a', newBuzzSessionId: 'new', now: 10 })).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    });
  });
});

describe('applyMatchNext', () => {
  it.each(GAME_STATUSES)('is accepted only from the match result, tested in %s', (status) => {
    const result = applyMatchNext(room({ status }), host);
    expect(result.ok).toBe(status === 'matchResult');
    if (!result.ok) expect(result.code).toBe('INVALID_STATE');
  });

  it.each(['a', 'stranger'])('rejects %s, who is not the host', (actorId) => {
    expect(applyMatchNext(room({ status: 'matchResult' }), { actorId, now: 9 })).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });

  it('zeroes every seat and keeps the seats, their presence and the rules', () => {
    const current = accepted(applyMatchFinish(room(), host));
    const before = structuredClone(current);
    const next = accepted(applyMatchNext(current, { actorId: 'h', now: 12 }));
    expect(next.status).toBe('idle');
    expect(next.rules).toEqual(SEVEN_MARU_THREE_BATSU);
    expect(next.participants).toEqual(
      before.participants.map((p) => ({ ...p, score: 0, correctCount: 0, wrongCount: 0 })),
    );
    expect(next.updatedAt).toBe(12);
    expect(current).toEqual(before);
  });

  it('lets a seat that won or was eliminated play again, under rules the host may now change', () => {
    const next = accepted(applyMatchNext(accepted(applyMatchFinish(room(), host)), host));
    const rules = { type: 'points', correctPoints: 2, wrongPoints: -1 } as const;
    expect(accepted(applyRulesUpdate(next, { actorId: 'h', rules, now: 13 })).rules).toEqual(rules);
    for (const participantId of ['a', 'b'])
      expect(applyBuzz(next, { participantId, newBuzzSessionId: 'new', now: 13 }).ok).toBe(true);
  });
});
