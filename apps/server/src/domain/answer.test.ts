/**
 * Tests for text answer submission.
 *
 * The first block covers each status and then checks actor permissions in an open round: every game status
 * comes from `GAME_STATUSES`, so a new status cannot be added without deciding here who may
 * answer in it. The table records the expected error code rather than just a boolean,
 * because the two refusals mean different things to the client and are easy to swap by
 * accident.
 *
 * The blocks after it pin what an accepted submission stores, that a resubmission replaces
 * the previous text rather than accumulating a history, and that nothing else in the room
 * moves — submitting an answer must not touch the buzz order or the answer right.
 */

import type {
  GameStatus,
  InternalRoomState,
  ParticipantState,
  SocketErrorCode,
} from '@quiz-world/shared';
import { GAME_STATUSES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyAnswerSubmit } from './answer';

const HOST_ID = 'participant-1';
/** Holds the answer right while the room is `answering`. */
const RESPONDER_ID = 'participant-2';
/** Seated, and in `buzzOrder` behind the responder, but without the answer right. */
const QUEUED_ID = 'participant-3';

const JOINED_AT = 1_700_000_000_000;
const EARLIER = 1_700_000_000_500;
const NOW = 1_700_000_001_000;
const LATER = 1_700_000_001_400;

const PARTICIPANTS: ParticipantState[] = [
  { id: HOST_ID, name: 'ホスト', online: true, joinedAt: JOINED_AT, score: 0 },
  { id: RESPONDER_ID, name: '太郎', online: true, joinedAt: JOINED_AT, score: 3 },
  { id: QUEUED_ID, name: '花子', online: true, joinedAt: JOINED_AT, score: 1 },
];

/**
 * A plausible room in the requested status.
 *
 * Only `answering` carries a responder. That is not a shortcut for the test: `showResult`
 * clears `currentResponderId`, and the other statuses never set it, so a room where somebody
 * holds the answer right outside `answering` is not a state the server can produce.
 */
function roomInStatus(status: GameStatus): InternalRoomState {
  switch (status) {
    case 'idle':
      return createRoomStateFixture({ participants: PARTICIPANTS });
    case 'answering':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'answering',
        currentBuzzSession: { id: 'buzz-session-1', startedAt: EARLIER },
        buzzOrder: [
          { participantId: RESPONDER_ID, receivedAt: EARLIER },
          { participantId: QUEUED_ID, receivedAt: EARLIER },
        ],
        currentResponderId: RESPONDER_ID,
      });
    case 'result':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'result',
        lastResult: { participantId: RESPONDER_ID, isCorrect: true, scoreDelta: 1 },
      });
    case 'paused':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'paused',
        statusBeforePause: 'answering',
        pausedReason: 'hostDisconnected',
        hostOnline: false,
        currentBuzzSession: { id: 'buzz-session-1', startedAt: EARLIER },
        buzzOrder: [{ participantId: RESPONDER_ID, receivedAt: EARLIER }],
        currentResponderId: RESPONDER_ID,
      });
    case 'finished':
      return createRoomStateFixture({ participants: PARTICIPANTS, status: 'finished' });
  }
}

/** Every status remains explicit without repeating the same rejection for all actor types. */
const SUBMIT_OUTCOME: Record<GameStatus, true | SocketErrorCode> = {
  idle: 'INVALID_STATE',
  answering: true,
  result: 'INVALID_STATE',
  paused: 'INVALID_STATE',
  finished: 'INVALID_STATE',
};
describe('applyAnswerSubmit admission', () => {
  it.each(GAME_STATUSES)('checks the answer right holder while %s', (status) => {
    const result = applyAnswerSubmit(roomInStatus(status), {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: NOW,
    });
    const outcome = SUBMIT_OUTCOME[status];
    if (outcome === true) expect(result.ok).toBe(true);
    else expect(result).toEqual({ ok: false, code: outcome });
  });
  it.each([QUEUED_ID, HOST_ID, 'no-such-participant'])(
    'refuses non-responder %s during an open round',
    (participantId) => {
      expect(
        applyAnswerSubmit(roomInStatus('answering'), {
          participantId,
          answerText: '東京',
          now: NOW,
        }),
      ).toEqual({ ok: false, code: 'NOT_CURRENT_RESPONDER' });
    },
  );
});

describe('applyAnswerSubmit while answering', () => {
  it('stores the answer with the sender and the server receive time', () => {
    const current = roomInStatus('answering');
    const before = structuredClone(current);

    const result = applyAnswerSubmit(current, {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      state: {
        ...current,
        currentSubmittedAnswer: {
          participantId: RESPONDER_ID,
          answerText: '東京',
          receivedAt: NOW,
        },
        updatedAt: NOW,
      },
    });
    expect(current).toEqual(before);
  });

  it('replaces an earlier answer instead of keeping a history', () => {
    const first = applyAnswerSubmit(roomInStatus('answering'), {
      participantId: RESPONDER_ID,
      answerText: '大阪',
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = applyAnswerSubmit(first.state, {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: LATER,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.state.currentSubmittedAnswer).toEqual({
      participantId: RESPONDER_ID,
      answerText: '東京',
      receivedAt: LATER,
    });
  });

  it('keeps the previous answer when a refused sender tries to overwrite it', () => {
    const answered = applyAnswerSubmit(roomInStatus('answering'), {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: NOW,
    });
    expect(answered.ok).toBe(true);
    if (!answered.ok) {
      return;
    }

    const refused = applyAnswerSubmit(answered.state, {
      participantId: QUEUED_ID,
      answerText: '横取り',
      now: LATER,
    });

    expect(refused).toEqual({ ok: false, code: 'NOT_CURRENT_RESPONDER' });
    expect(answered.state.currentSubmittedAnswer?.answerText).toBe('東京');
  });
});
