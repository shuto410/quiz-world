/**
 * Tests for text answer submission.
 *
 * The first block is the status-by-actor table required by the design: every game status
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

const ACTORS = ['responder', 'queued', 'host', 'stranger'] as const;

type Actor = (typeof ACTORS)[number];

const ACTOR_IDS: Record<Actor, string> = {
  responder: RESPONDER_ID,
  queued: QUEUED_ID,
  host: HOST_ID,
  stranger: 'no-such-participant',
};

/** `true` means accepted; anything else is the code the refusal must carry. */
type Outcome = true | SocketErrorCode;

/**
 * The outcome of a submission for every status and every kind of sender.
 *
 * `Record<GameStatus, ...>` is what makes this exhaustive: adding a status to the domain
 * stops this file from compiling until the new row is filled in.
 */
const SUBMIT_OUTCOME: Record<GameStatus, Record<Actor, Outcome>> = {
  // Nobody holds the answer right, so the status is what refuses the send.
  idle: {
    responder: 'INVALID_STATE',
    queued: 'INVALID_STATE',
    host: 'INVALID_STATE',
    stranger: 'INVALID_STATE',
  },
  // The one status where the answer right exists, so it is the one that distinguishes senders.
  answering: {
    responder: true,
    queued: 'NOT_CURRENT_RESPONDER',
    host: 'NOT_CURRENT_RESPONDER',
    stranger: 'NOT_CURRENT_RESPONDER',
  },
  result: {
    responder: 'INVALID_STATE',
    queued: 'INVALID_STATE',
    host: 'INVALID_STATE',
    stranger: 'INVALID_STATE',
  },
  // Paused keeps the responder recorded for the resume, but the room accepts nothing.
  paused: {
    responder: 'INVALID_STATE',
    queued: 'INVALID_STATE',
    host: 'INVALID_STATE',
    stranger: 'INVALID_STATE',
  },
  finished: {
    responder: 'INVALID_STATE',
    queued: 'INVALID_STATE',
    host: 'INVALID_STATE',
    stranger: 'INVALID_STATE',
  },
};

describe('applyAnswerSubmit: status by actor', () => {
  for (const status of GAME_STATUSES) {
    for (const actor of ACTORS) {
      const outcome = SUBMIT_OUTCOME[status][actor];
      const label = outcome === true ? 'accepts' : `rejects with ${outcome}`;

      it(`${label} an answer from the ${actor} while ${status}`, () => {
        const result = applyAnswerSubmit(roomInStatus(status), {
          participantId: ACTOR_IDS[actor],
          answerText: '東京',
          now: NOW,
        });

        if (outcome === true) {
          expect(result.ok).toBe(true);
          return;
        }
        expect(result).toEqual({ ok: false, code: outcome });
      });
    }
  }
});

describe('applyAnswerSubmit while answering', () => {
  it('stores the answer with the sender and the server receive time', () => {
    const current = roomInStatus('answering');

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

  it('leaves the buzz order, the answer right and the scores alone', () => {
    const current = roomInStatus('answering');

    const result = applyAnswerSubmit(current, {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.buzzOrder).toEqual(current.buzzOrder);
    expect(result.state.currentResponderId).toBe(RESPONDER_ID);
    expect(result.state.currentBuzzSession).toEqual(current.currentBuzzSession);
    expect(result.state.participants).toEqual(PARTICIPANTS);
  });

  it('does not modify the state it was given', () => {
    const current = roomInStatus('answering');
    const before = structuredClone(current);

    applyAnswerSubmit(current, {
      participantId: RESPONDER_ID,
      answerText: '東京',
      now: NOW,
    });

    expect(current).toEqual(before);
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
