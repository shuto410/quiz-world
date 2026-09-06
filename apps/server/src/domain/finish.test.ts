/**
 * Tests for ending a tournament and closing the room.
 *
 * Both are keyed on `GAME_STATUSES`, so a new status has to be classified here before it can
 * exist. The statuses matter more than usual for these two operations: finishing while
 * somebody holds the answer right would strand them, and closing is what disconnects the
 * room, so it must not be reachable mid-game.
 *
 * The scoring is checked too, in the negative: ending a tournament may move nobody's score.
 * The standings shown on the final screen have to be the ones the last judgement produced.
 */

import type { GameStatus, InternalRoomState, ParticipantState } from '@quiz-world/shared';
import { GAME_STATUSES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyTournamentFinish, checkRoomClose } from './finish';

const HOST_ID = 'participant-1';
const RESPONDER_ID = 'participant-2';
const OTHER_ID = 'participant-3';

const JOINED_AT = 1_700_000_000_000;
const EARLIER = 1_700_000_000_500;
const NOW = 1_700_000_001_000;

const PARTICIPANTS: ParticipantState[] = [
  { id: HOST_ID, name: 'ホスト', online: true, joinedAt: JOINED_AT, score: 0 },
  { id: RESPONDER_ID, name: '太郎', online: true, joinedAt: JOINED_AT, score: 5 },
  { id: OTHER_ID, name: '花子', online: false, joinedAt: JOINED_AT, score: 5 },
];

function roomInStatus(status: GameStatus): InternalRoomState {
  switch (status) {
    case 'idle':
      return createRoomStateFixture({ participants: PARTICIPANTS });
    case 'answering':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'answering',
        currentBuzzSession: { id: 'buzz-session-1', startedAt: EARLIER },
        buzzOrder: [{ participantId: RESPONDER_ID, receivedAt: EARLIER }],
        currentResponderId: RESPONDER_ID,
        currentSubmittedAnswer: {
          participantId: RESPONDER_ID,
          answerText: '東京',
          receivedAt: EARLIER,
        },
      });
    case 'result':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'result',
        currentSubmittedAnswer: {
          participantId: RESPONDER_ID,
          answerText: '東京',
          receivedAt: EARLIER,
        },
        lastResult: { participantId: RESPONDER_ID, isCorrect: true, scoreDelta: 1 },
      });
    case 'paused':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'paused',
        statusBeforePause: 'idle',
        pausedReason: 'hostDisconnected',
        hostOnline: false,
      });
    case 'finished':
      return createRoomStateFixture({ participants: PARTICIPANTS, status: 'finished' });
  }
}

/** Whether the host may end the tournament from each status. */
const FINISH_ACCEPTED: Record<GameStatus, boolean> = {
  idle: true,
  // Somebody holds the answer right; the host judges or resets first.
  answering: false,
  result: true,
  paused: false,
  finished: false,
};

describe('applyTournamentFinish', () => {
  for (const status of GAME_STATUSES) {
    const accepted = FINISH_ACCEPTED[status];

    it(`${accepted ? 'accepts' : 'rejects'} the host ending the tournament while ${status}`, () => {
      const result = applyTournamentFinish(roomInStatus(status), { actorId: HOST_ID, now: NOW });

      expect(result.ok).toBe(accepted);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_STATE');
      }
    });
  }

  it.each([RESPONDER_ID, 'no-such-participant'])('rejects %s, who is not the host', (actorId) => {
    expect(applyTournamentFinish(roomInStatus('idle'), { actorId, now: NOW })).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });

  it('clears the last round so the final screen shows standings only', () => {
    const result = applyTournamentFinish(roomInStatus('result'), { actorId: HOST_ID, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('finished');
    expect(result.state.buzzOrder).toEqual([]);
    expect(result.state).not.toHaveProperty('lastResult');
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
    expect(result.state).not.toHaveProperty('currentBuzzSession');
    expect(result.state).not.toHaveProperty('currentResponderId');
  });

  it('keeps every score and seat, including those who left', () => {
    const result = applyTournamentFinish(roomInStatus('idle'), { actorId: HOST_ID, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.participants).toEqual(PARTICIPANTS);
  });

  it('does not modify the state it was given', () => {
    const current = roomInStatus('result');
    const before = structuredClone(current);

    applyTournamentFinish(current, { actorId: HOST_ID, now: NOW });

    expect(current).toEqual(before);
  });
});

/** Whether the host may close the room from each status. */
const CLOSE_ACCEPTED: Record<GameStatus, boolean> = {
  idle: false,
  answering: false,
  result: false,
  paused: false,
  finished: true,
};

describe('checkRoomClose', () => {
  for (const status of GAME_STATUSES) {
    const accepted = CLOSE_ACCEPTED[status];

    it(`${accepted ? 'allows' : 'refuses'} closing the room while ${status}`, () => {
      const result = checkRoomClose(roomInStatus(status), HOST_ID);

      expect(result.ok).toBe(accepted);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_STATE');
      }
    });
  }

  it.each([RESPONDER_ID, 'no-such-participant'])('refuses %s, who is not the host', (actorId) => {
    expect(checkRoomClose(roomInStatus('finished'), actorId)).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });
});
