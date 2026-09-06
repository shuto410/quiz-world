/**
 * Tests for judgement and round-reset transitions.
 *
 * Three tables come first, because a judgement is the one operation that changes a score,
 * and the ways it can be aimed wrongly are all cheap to write and expensive to miss: the
 * wrong status, the wrong sender, the wrong target. Each table is keyed by a constant from
 * the domain (`GAME_STATUSES`, `JUDGE_NEXT_ACTIONS`), so adding a status or an action stops
 * this file from compiling until the new row is filled in.
 *
 * The blocks after them pin the reset scope of each action, which is where this step is most
 * likely to drift: what `showResult` keeps, what `resetToIdle` clears, and what
 * `moveToNextResponder` must leave alone for the buzz ranks to stay meaningful.
 *
 * Nothing here is asynchronous. As with the buzz tests, an `await` in this file would mean
 * the atomicity of the real handler had already been lost.
 */

import type {
  GameStatus,
  InternalRoomState,
  JudgeNextAction,
  ParticipantState,
  SocketErrorCode,
  SubmittedAnswerState,
} from '@quiz-world/shared';
import { GAME_STATUSES, JUDGE_NEXT_ACTIONS } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyGameReset, applyJudge } from './judge';

const HOST_ID = 'participant-1';
/** Holds the answer right in the `answering` fixture, and is first in `buzzOrder`. */
const RESPONDER_ID = 'participant-2';
/** Second in `buzzOrder`, so the next responder when the right moves on. */
const QUEUED_ID = 'participant-3';
const STRANGER_ID = 'no-such-participant';

const JOINED_AT = 1_700_000_000_000;
const EARLIER = 1_700_000_000_500;
const NOW = 1_700_000_001_000;

const RESPONDER_SCORE = 3;
const QUEUED_SCORE = 1;

const PARTICIPANTS: ParticipantState[] = [
  { id: HOST_ID, name: 'ホスト', online: true, joinedAt: JOINED_AT, score: 0 },
  { id: RESPONDER_ID, name: '太郎', online: true, joinedAt: JOINED_AT, score: RESPONDER_SCORE },
  { id: QUEUED_ID, name: '花子', online: true, joinedAt: JOINED_AT, score: QUEUED_SCORE },
];

const SUBMITTED_ANSWER: SubmittedAnswerState = {
  participantId: RESPONDER_ID,
  answerText: '東京',
  receivedAt: EARLIER,
};

const OPEN_SESSION = { id: 'buzz-session-1', startedAt: EARLIER };

/** A room mid-round: the responder holds the answer right with one participant queued. */
function answeringRoom(overrides: Partial<InternalRoomState> = {}): InternalRoomState {
  return createRoomStateFixture({
    participants: PARTICIPANTS,
    status: 'answering',
    currentBuzzSession: OPEN_SESSION,
    buzzOrder: [
      { participantId: RESPONDER_ID, receivedAt: EARLIER },
      { participantId: QUEUED_ID, receivedAt: EARLIER },
    ],
    currentResponderId: RESPONDER_ID,
    currentSubmittedAnswer: SUBMITTED_ANSWER,
    ...overrides,
  });
}

/**
 * A plausible room in the requested status.
 *
 * `paused` deliberately carries a live round: pausing preserves it for the resume, so this is
 * the fixture that proves the status gate, and not the absence of a responder, is what
 * refuses a judgement there.
 */
function roomInStatus(status: GameStatus): InternalRoomState {
  switch (status) {
    case 'idle':
      return createRoomStateFixture({ participants: PARTICIPANTS });
    case 'answering':
      return answeringRoom();
    case 'result':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'result',
        currentSubmittedAnswer: SUBMITTED_ANSWER,
        lastResult: { participantId: RESPONDER_ID, isCorrect: true, scoreDelta: 1 },
      });
    case 'paused':
      return answeringRoom({
        status: 'paused',
        statusBeforePause: 'answering',
        pausedReason: 'hostDisconnected',
        hostOnline: false,
      });
    case 'finished':
      return createRoomStateFixture({ participants: PARTICIPANTS, status: 'finished' });
  }
}

/** A judgement of the current responder, sent by the host. */
function judgement(overrides: Partial<Parameters<typeof applyJudge>[1]> = {}) {
  return {
    actorId: HOST_ID,
    targetParticipantId: RESPONDER_ID,
    isCorrect: true,
    scoreDelta: 1,
    nextAction: 'showResult' as JudgeNextAction,
    now: NOW,
    ...overrides,
  };
}

function scoreOf(state: InternalRoomState, participantId: string): number | undefined {
  return state.participants.find((participant) => participant.id === participantId)?.score;
}

/** `true` means accepted; anything else is the code the refusal must carry. */
type Outcome = true | SocketErrorCode;

/**
 * Whether a judgement is accepted, for every status and every follow-up action.
 *
 * `answering` accepts all three because the fixture has somebody queued behind the
 * responder; the empty-queue case is covered separately.
 */
const JUDGE_OUTCOME: Record<GameStatus, Record<JudgeNextAction, Outcome>> = {
  idle: {
    showResult: 'INVALID_STATE',
    resetToIdle: 'INVALID_STATE',
    moveToNextResponder: 'INVALID_STATE',
  },
  answering: { showResult: true, resetToIdle: true, moveToNextResponder: true },
  result: {
    showResult: 'INVALID_STATE',
    resetToIdle: 'INVALID_STATE',
    moveToNextResponder: 'INVALID_STATE',
  },
  paused: {
    showResult: 'INVALID_STATE',
    resetToIdle: 'INVALID_STATE',
    moveToNextResponder: 'INVALID_STATE',
  },
  finished: {
    showResult: 'INVALID_STATE',
    resetToIdle: 'INVALID_STATE',
    moveToNextResponder: 'INVALID_STATE',
  },
};

describe('applyJudge: status by next action', () => {
  for (const status of GAME_STATUSES) {
    for (const nextAction of JUDGE_NEXT_ACTIONS) {
      const outcome = JUDGE_OUTCOME[status][nextAction];
      const label = outcome === true ? 'accepts' : `rejects with ${outcome}`;

      it(`${label} ${nextAction} while ${status}`, () => {
        const result = applyJudge(roomInStatus(status), judgement({ nextAction }));

        if (outcome === true) {
          expect(result.ok).toBe(true);
          return;
        }
        expect(result).toEqual({ ok: false, code: outcome });
      });
    }
  }
});

describe('applyJudge: who may judge', () => {
  const senders: { name: string; actorId: string; outcome: Outcome }[] = [
    { name: 'the host', actorId: HOST_ID, outcome: true },
    { name: 'the responder being judged', actorId: RESPONDER_ID, outcome: 'NOT_HOST' },
    { name: 'a queued participant', actorId: QUEUED_ID, outcome: 'NOT_HOST' },
    { name: 'somebody with no seat', actorId: STRANGER_ID, outcome: 'NOT_HOST' },
  ];

  it.each(senders)('$outcome for a judgement from $name', ({ actorId, outcome }) => {
    const result = applyJudge(roomInStatus('answering'), judgement({ actorId }));

    if (outcome === true) {
      expect(result.ok).toBe(true);
      return;
    }
    expect(result).toEqual({ ok: false, code: outcome });
  });

  it('refuses a host id that no longer holds authority', () => {
    // Authority moved to another participant, so the original host is an ordinary player.
    const claimed = answeringRoom({ hostId: QUEUED_ID });

    expect(applyJudge(claimed, judgement({ actorId: HOST_ID }))).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });
});

describe('applyJudge: who may be judged', () => {
  const targets: { name: string; targetParticipantId: string; outcome: Outcome }[] = [
    { name: 'the current responder', targetParticipantId: RESPONDER_ID, outcome: true },
    {
      name: 'a participant queued behind them',
      targetParticipantId: QUEUED_ID,
      outcome: 'INVALID_STATE',
    },
    { name: 'the host seat', targetParticipantId: HOST_ID, outcome: 'INVALID_STATE' },
    { name: 'an id with no seat', targetParticipantId: STRANGER_ID, outcome: 'INVALID_STATE' },
  ];

  it.each(targets)('$outcome when judging $name', ({ targetParticipantId, outcome }) => {
    const result = applyJudge(roomInStatus('answering'), judgement({ targetParticipantId }));

    if (outcome === true) {
      expect(result.ok).toBe(true);
      return;
    }
    expect(result).toEqual({ ok: false, code: outcome });
  });

  it('leaves every score untouched when the target is refused', () => {
    const current = roomInStatus('answering');

    expect(applyJudge(current, judgement({ targetParticipantId: QUEUED_ID })).ok).toBe(false);
    expect(scoreOf(current, QUEUED_ID)).toBe(QUEUED_SCORE);
    expect(scoreOf(current, RESPONDER_ID)).toBe(RESPONDER_SCORE);
  });
});

describe('applyJudge: scoring', () => {
  it.each(JUDGE_NEXT_ACTIONS)('adds the delta to the judged participant with %s', (nextAction) => {
    const result = applyJudge(roomInStatus('answering'), judgement({ nextAction, scoreDelta: 2 }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(scoreOf(result.state, RESPONDER_ID)).toBe(RESPONDER_SCORE + 2);
    expect(scoreOf(result.state, QUEUED_ID)).toBe(QUEUED_SCORE);
    expect(scoreOf(result.state, HOST_ID)).toBe(0);
  });

  it('lets a score go negative, since a wrong answer may cost more than it is worth', () => {
    const result = applyJudge(
      roomInStatus('answering'),
      judgement({ isCorrect: false, scoreDelta: -5 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(scoreOf(result.state, RESPONDER_ID)).toBe(RESPONDER_SCORE - 5);
  });

  it('accepts a correct answer worth nothing, since the points are the host s to decide', () => {
    const result = applyJudge(roomInStatus('answering'), judgement({ scoreDelta: 0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(scoreOf(result.state, RESPONDER_ID)).toBe(RESPONDER_SCORE);
  });
});

describe('applyJudge: showResult', () => {
  it('closes the round and keeps the answer for the result screen', () => {
    const result = applyJudge(
      roomInStatus('answering'),
      judgement({ nextAction: 'showResult', isCorrect: true, scoreDelta: 1 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('result');
    expect(result.state.lastResult).toEqual({
      participantId: RESPONDER_ID,
      isCorrect: true,
      scoreDelta: 1,
    });
    // The judgement is what participants are finally allowed to read the answer with.
    expect(result.state.currentSubmittedAnswer).toEqual(SUBMITTED_ANSWER);
    expect(result.state.buzzOrder).toEqual([]);
    expect(result.state).not.toHaveProperty('currentBuzzSession');
    expect(result.state).not.toHaveProperty('currentResponderId');
  });

  it('records a wrong answer with the deduction it cost', () => {
    const result = applyJudge(
      roomInStatus('answering'),
      judgement({ nextAction: 'showResult', isCorrect: false, scoreDelta: -1 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.lastResult).toEqual({
      participantId: RESPONDER_ID,
      isCorrect: false,
      scoreDelta: -1,
    });
  });

  it('judges a responder who never sent any text', () => {
    // Built without the answer key rather than with an undefined one, so that the assertion
    // below distinguishes "absent" from "present and empty".
    const silent = createRoomStateFixture({
      participants: PARTICIPANTS,
      status: 'answering',
      currentBuzzSession: OPEN_SESSION,
      buzzOrder: [{ participantId: RESPONDER_ID, receivedAt: EARLIER }],
      currentResponderId: RESPONDER_ID,
    });

    const result = applyJudge(silent, judgement({ nextAction: 'showResult' }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('result');
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
  });
});

describe('applyJudge: resetToIdle', () => {
  it('clears the round and the judgement without showing a result', () => {
    const result = applyJudge(
      roomInStatus('answering'),
      judgement({ nextAction: 'resetToIdle', scoreDelta: 1 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('idle');
    expect(result.state.buzzOrder).toEqual([]);
    expect(result.state).not.toHaveProperty('currentBuzzSession');
    expect(result.state).not.toHaveProperty('currentResponderId');
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
    expect(result.state).not.toHaveProperty('lastResult');
    // The score still moved: the answer was judged, only the result screen was skipped.
    expect(scoreOf(result.state, RESPONDER_ID)).toBe(RESPONDER_SCORE + 1);
  });
});

describe('applyJudge: moveToNextResponder', () => {
  it('passes the answer right to the next entry and keeps the round open', () => {
    const current = roomInStatus('answering');

    const result = applyJudge(
      current,
      judgement({ nextAction: 'moveToNextResponder', isCorrect: false, scoreDelta: -1 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('answering');
    expect(result.state.currentResponderId).toBe(QUEUED_ID);
    // Same round, same ranks: the order is what the next responder was chosen from.
    expect(result.state.currentBuzzSession).toEqual(current.currentBuzzSession);
    expect(result.state.buzzOrder).toEqual(current.buzzOrder);
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
    expect(scoreOf(result.state, RESPONDER_ID)).toBe(RESPONDER_SCORE - 1);
  });

  it('refuses when the responder is last in the order, changing nothing', () => {
    const lastInOrder = answeringRoom({
      buzzOrder: [{ participantId: RESPONDER_ID, receivedAt: EARLIER }],
    });

    expect(
      applyJudge(lastInOrder, judgement({ nextAction: 'moveToNextResponder', scoreDelta: 1 })),
    ).toEqual({ ok: false, code: 'NO_NEXT_RESPONDER' });
    // Refusal must not bank the points, or the host would pay twice for one retry.
    expect(scoreOf(lastInOrder, RESPONDER_ID)).toBe(RESPONDER_SCORE);
  });

  it('refuses rather than guess when the responder is not in the order at all', () => {
    // Not a state the current transitions can produce, but a snapshot written by an older
    // build could be. Refusing keeps the answer right where it is; picking the first entry
    // instead would hand it to somebody the host never judged.
    const inconsistent = answeringRoom({
      buzzOrder: [{ participantId: QUEUED_ID, receivedAt: EARLIER }],
    });

    expect(
      applyJudge(inconsistent, judgement({ nextAction: 'moveToNextResponder', scoreDelta: 1 })),
    ).toEqual({ ok: false, code: 'NO_NEXT_RESPONDER' });
  });

  it('does not skip an offline participant', () => {
    const withOfflineNext = answeringRoom({
      participants: PARTICIPANTS.map((participant) =>
        participant.id === QUEUED_ID ? { ...participant, online: false } : participant,
      ),
    });

    const result = applyJudge(withOfflineNext, judgement({ nextAction: 'moveToNextResponder' }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.currentResponderId).toBe(QUEUED_ID);
  });
});

describe('applyJudge: immutability', () => {
  it.each(JUDGE_NEXT_ACTIONS)('does not modify the state it was given with %s', (nextAction) => {
    const current = roomInStatus('answering');
    const before = structuredClone(current);

    applyJudge(current, judgement({ nextAction }));

    expect(current).toEqual(before);
  });
});

/** Whether closing the result screen is accepted, per status. */
const RESET_OUTCOME: Record<GameStatus, Outcome> = {
  idle: 'INVALID_STATE',
  answering: 'INVALID_STATE',
  result: true,
  paused: 'INVALID_STATE',
  finished: 'INVALID_STATE',
};

describe('applyGameReset', () => {
  for (const status of GAME_STATUSES) {
    const outcome = RESET_OUTCOME[status];
    const label = outcome === true ? 'accepts' : `rejects with ${outcome}`;

    it(`${label} a reset while ${status}`, () => {
      const result = applyGameReset(roomInStatus(status), { actorId: HOST_ID, now: NOW });

      if (outcome === true) {
        expect(result.ok).toBe(true);
        return;
      }
      expect(result).toEqual({ ok: false, code: outcome });
    });
  }

  it.each([RESPONDER_ID, STRANGER_ID])('rejects a reset sent by %s', (actorId) => {
    expect(applyGameReset(roomInStatus('result'), { actorId, now: NOW })).toEqual({
      ok: false,
      code: 'NOT_HOST',
    });
  });

  it('reopens buzzing and drops the judgement that was on screen', () => {
    const result = applyGameReset(roomInStatus('result'), { actorId: HOST_ID, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.status).toBe('idle');
    expect(result.state.buzzOrder).toEqual([]);
    expect(result.state).not.toHaveProperty('lastResult');
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
    expect(result.state).not.toHaveProperty('currentBuzzSession');
    expect(result.state).not.toHaveProperty('currentResponderId');
  });

  it('leaves the standings alone', () => {
    const result = applyGameReset(roomInStatus('result'), { actorId: HOST_ID, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.participants).toEqual(PARTICIPANTS);
  });

  it('does not modify the state it was given', () => {
    const current = roomInStatus('result');
    const before = structuredClone(current);

    applyGameReset(current, { actorId: HOST_ID, now: NOW });

    expect(current).toEqual(before);
  });
});
