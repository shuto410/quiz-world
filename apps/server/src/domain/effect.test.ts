/**
 * Tests for the host sounding the cue without a verdict.
 *
 * Keyed on `GAME_STATUSES`, so a new status has to be classified here before it can exist.
 */

import { GAME_STATUSES, type GameStatus } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { checkEffectPlay } from './effect';

/** Whether a cue without a verdict is allowed in each status. */
const EFFECT_ACCEPTED: Record<GameStatus, boolean> = {
  idle: true,
  // The same buttons judge the responder here; a bare cue would pass for a verdict.
  answering: false,
  result: true,
  matchResult: true,
  paused: false,
  finished: false,
};

describe('checkEffectPlay', () => {
  it.each(GAME_STATUSES)(
    'is allowed only while nobody awaits a verdict, tested in %s',
    (status) => {
      const result = checkEffectPlay(createRoomStateFixture({ status }), 'participant-1');
      expect(result.ok).toBe(EFFECT_ACCEPTED[status]);
      if (!result.ok) expect(result.code).toBe('INVALID_STATE');
    },
  );

  it('refuses anyone but the host', () => {
    expect(checkEffectPlay(createRoomStateFixture(), 'participant-2')).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });
});
