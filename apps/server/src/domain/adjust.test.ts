/**
 * Tests for the host correcting a seat by hand.
 *
 * Keyed on `GAME_STATUSES`, so a new status has to be classified here before it can exist.
 * Beyond admission, what matters is that a correction has the same consequences as play
 * would have had: a seat corrected past a threshold is out, and one corrected back is in.
 */

import {
  GAME_STATUSES,
  SEVEN_MARU_THREE_BATSU,
  type GameStatus,
  type InternalRoomState,
  type ScoreAdjustment,
} from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyScoreAdjust } from './adjust';
import { applyBuzz } from './buzz';
import { applyRulesUpdate } from './rules';

const points: ScoreAdjustment = { type: 'points', score: 12 };

function room(overrides: Partial<InternalRoomState> = {}): InternalRoomState {
  return createRoomStateFixture({
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
      { id: 'a', name: 'A', score: 3, correctCount: 3, wrongCount: 1, online: true, joinedAt: 1 },
      { id: 'b', name: 'B', score: 0, correctCount: 0, wrongCount: 0, online: false, joinedAt: 2 },
    ],
    ...overrides,
  });
}
const adjust = (current: InternalRoomState, adjustment: ScoreAdjustment, target = 'a') =>
  applyScoreAdjust(current, { actorId: 'h', targetParticipantId: target, adjustment, now: 9 });
function accepted(result: ReturnType<typeof applyScoreAdjust>): InternalRoomState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

/** Whether the host may correct a seat in each status. */
const ADJUST_ACCEPTED: Record<GameStatus, boolean> = {
  idle: true,
  // The responder's pending answer must stay judgeable.
  answering: false,
  result: true,
  matchResult: true,
  paused: false,
  finished: false,
};

describe('applyScoreAdjust', () => {
  it.each(GAME_STATUSES)('is accepted only while nobody may answer, tested in %s', (status) => {
    const result = adjust(room({ status }), points);
    expect(result.ok).toBe(ADJUST_ACCEPTED[status]);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE');
  });

  it.each(['a', 'stranger'])('rejects %s, who is not the host', (actorId) => {
    expect(
      applyScoreAdjust(room(), { actorId, targetParticipantId: 'a', adjustment: points, now: 9 }),
    ).toEqual({ ok: false, code: 'NOT_HOST' });
  });

  it.each(['h', 'absent'])('refuses to correct %s, who is not a competing seat', (target) => {
    expect(adjust(room(), points, target)).toEqual({ ok: false, code: 'INVALID_STATE' });
  });

  it('refuses a correction written for rules that are not in force', () => {
    expect(adjust(room(), { type: 'maruBatsu', correctCount: 1, wrongCount: 0 }).ok).toBe(false);
    expect(adjust(room({ rules: SEVEN_MARU_THREE_BATSU }), points).ok).toBe(false);
  });

  it('sets only the score under points, on only the named seat', () => {
    const current = room({
      status: 'result',
      lastResult: { participantId: 'a', isCorrect: true, scoreDelta: 1 },
    });
    const before = structuredClone(current);
    const next = accepted(adjust(current, { type: 'points', score: -4 }));
    expect(next.participants[1]).toEqual({ ...before.participants[1], score: -4 });
    expect(next.participants[0]).toEqual(before.participants[0]);
    expect(next.participants[2]).toEqual(before.participants[2]);
    expect(next.status).toBe('result');
    expect(next.lastResult).toEqual(before.lastResult);
    expect(next.updatedAt).toBe(9);
    expect(current).toEqual(before);
    // New totals, not differences: a repeated request changes nothing.
    expect(accepted(adjust(next, { type: 'points', score: -4 })).participants).toEqual(
      next.participants,
    );
  });

  it('sets the counts under n○m× and keeps the score in step with the correct count', () => {
    const next = accepted(
      adjust(room({ rules: SEVEN_MARU_THREE_BATSU }), {
        type: 'maruBatsu',
        correctCount: 5,
        wrongCount: 2,
      }),
    );
    expect(next.participants[1]).toMatchObject({ score: 5, correctCount: 5, wrongCount: 2 });
  });

  it('takes a seat out of play and puts it back, exactly as the thresholds say', () => {
    const playing = room({ rules: SEVEN_MARU_THREE_BATSU });
    const buzz = (state: InternalRoomState) =>
      applyBuzz(state, { participantId: 'a', newBuzzSessionId: 'new', now: 10 }).ok;
    for (const out of [
      { correctCount: 7, wrongCount: 0 },
      { correctCount: 0, wrongCount: 3 },
    ]) {
      const stopped = accepted(adjust(playing, { type: 'maruBatsu', ...out }));
      expect(buzz(stopped)).toBe(false);
      const restored = accepted(
        adjust(stopped, { type: 'maruBatsu', correctCount: 6, wrongCount: 2 }),
      );
      expect(buzz(restored)).toBe(true);
    }
  });

  it('locks the rules like a judgement does, and unlocks them once everyone is back at zero', () => {
    const fresh = room();
    fresh.participants = fresh.participants.map((p) => ({
      ...p,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
    }));
    const rules = { actorId: 'h', rules: SEVEN_MARU_THREE_BATSU, now: 11 };
    const handicapped = accepted(adjust(fresh, { type: 'points', score: 2 }, 'b'));
    expect(applyRulesUpdate(handicapped, rules).ok).toBe(false);
    const cleared = accepted(adjust(handicapped, { type: 'points', score: 0 }, 'b'));
    expect(applyRulesUpdate(cleared, rules).ok).toBe(true);
  });
});
